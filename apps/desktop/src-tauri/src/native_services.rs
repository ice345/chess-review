use serde::{Deserialize, Serialize};
use std::{
    env,
    io::{Read, Write},
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

const DEFAULT_OLLAMA_HOST: &str = "127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL: &str = "gemma4:12b-it-qat";
const DEFAULT_LOCAL_AI_HOST: &str = "127.0.0.1:8000";
pub(crate) const SERVICES_CHANGED_EVENT: &str = "desktop://services-changed";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeServiceStatus {
    pub ollama: String,
    pub owned: bool,
    pub models: Vec<String>,
    pub configured_model: String,
    pub message: String,
    pub local_ai: String,
    pub local_ai_owned: bool,
    pub local_ai_message: String,
}

impl NativeServiceStatus {
    fn checking() -> Self {
        Self {
            ollama: "checking".into(),
            owned: false,
            models: vec![],
            configured_model: configured_model(),
            message: "Checking for an existing local Ollama service…".into(),
            local_ai: "checking".into(),
            local_ai_owned: false,
            local_ai_message: "Checking for an existing local-ai service…".into(),
        }
    }
}

#[derive(Default)]
struct NativeServicesInner {
    ollama_child: Option<Child>,
    local_ai_child: Option<CommandChild>,
    status: Option<NativeServiceStatus>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeServices(Arc<Mutex<NativeServicesInner>>);

#[derive(Deserialize)]
struct OllamaTags {
    models: Vec<OllamaTag>,
}

#[derive(Deserialize)]
struct OllamaTag {
    name: String,
}

fn configured_model() -> String {
    env::var("OLLAMA_MODEL").unwrap_or_else(|_| DEFAULT_OLLAMA_MODEL.into())
}

fn configured_host() -> String {
    env::var("OLLAMA_HOST")
        .or_else(|_| env::var("OLLAMA_BASE_URL"))
        .unwrap_or_else(|_| DEFAULT_OLLAMA_HOST.into())
}

fn configured_local_ai_host() -> String {
    env::var("LOCAL_AI_URL")
        .or_else(|_| env::var("NEXT_PUBLIC_LOCAL_AI_URL"))
        .unwrap_or_else(|_| DEFAULT_LOCAL_AI_HOST.into())
}

fn local_endpoint(value: &str, default_port: u16) -> Result<SocketAddr, String> {
    let authority = value
        .trim()
        .strip_prefix("http://")
        .unwrap_or(value.trim())
        .trim_end_matches('/')
        .split('/')
        .next()
        .unwrap_or_default();
    let authority = if authority.contains(':') {
        authority.to_string()
    } else {
        format!("{authority}:{default_port}")
    };
    let addresses = authority
        .to_socket_addrs()
        .map_err(|error| format!("Invalid local service host: {error}"))?
        .filter(|address| address.ip().is_loopback())
        .collect::<Vec<_>>();
    addresses
        .iter()
        .copied()
        .find(SocketAddr::is_ipv4)
        .or_else(|| addresses.first().copied())
        .ok_or_else(|| "Desktop-managed services must use a loopback address.".into())
}

fn read_http_json(endpoint: SocketAddr, path: &str) -> Result<String, String> {
    let mut stream = TcpStream::connect_timeout(&endpoint, Duration::from_millis(450))
        .map_err(|_| "Local API is offline.".to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_millis(700)))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_millis(700)))
        .map_err(|error| error.to_string())?;
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: {endpoint}\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
    )
    .map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "The local service returned an invalid HTTP response.".to_string())?;
    if !headers
        .lines()
        .next()
        .is_some_and(|line| line.contains(" 200 "))
    {
        return Err(format!(
            "The local service endpoint {path} did not return HTTP 200."
        ));
    }
    Ok(body.to_string())
}

fn port_reachable(endpoint: SocketAddr) -> bool {
    TcpStream::connect_timeout(&endpoint, Duration::from_millis(450)).is_ok()
}

fn probe_ollama(endpoint: SocketAddr) -> Result<Vec<String>, String> {
    let mut models = serde_json::from_str::<OllamaTags>(&read_http_json(endpoint, "/api/tags")?)
        .map_err(|error| format!("Ollama returned invalid model JSON: {error}"))?
        .models
        .into_iter()
        .map(|model| model.name)
        .collect::<Vec<_>>();
    models.sort();
    models.dedup();
    Ok(models)
}

fn probe_local_ai(endpoint: SocketAddr) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&read_http_json(endpoint, "/health")?)
        .map(|_| ())
        .map_err(|error| format!("local-ai returned invalid health JSON: {error}"))
}

fn executable_in_path(path: &Path, name: &str) -> Option<PathBuf> {
    let candidate = path.join(name);
    candidate.is_file().then_some(candidate)
}

fn find_ollama_executable() -> Option<PathBuf> {
    let executable = if cfg!(windows) {
        "ollama.exe"
    } else {
        "ollama"
    };
    if let Some(found) = env::var_os("PATH")
        .into_iter()
        .flat_map(|value| env::split_paths(&value).collect::<Vec<_>>())
        .find_map(|path| executable_in_path(&path, executable))
    {
        return Some(found);
    }

    let mut known = vec![
        PathBuf::from("/opt/homebrew/bin/ollama"),
        PathBuf::from("/usr/local/bin/ollama"),
        PathBuf::from("/usr/bin/ollama"),
        PathBuf::from("/Applications/Ollama.app/Contents/Resources/ollama"),
    ];
    if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
        known.push(PathBuf::from(local_app_data).join("Programs/Ollama/ollama.exe"));
    }
    known.into_iter().find(|path| path.is_file())
}

impl NativeServices {
    pub(crate) fn status(&self) -> NativeServiceStatus {
        self.0
            .lock()
            .ok()
            .and_then(|inner| inner.status.clone())
            .unwrap_or_else(NativeServiceStatus::checking)
    }

    pub(crate) fn start_or_refresh(&self, app: &AppHandle) -> NativeServiceStatus {
        self.refresh_ollama();
        self.refresh_local_ai(app);
        self.status()
    }

    fn refresh_ollama(&self) -> NativeServiceStatus {
        let configured_model = configured_model();
        let endpoint = match local_endpoint(&configured_host(), 11434) {
            Ok(endpoint) => endpoint,
            Err(message) => return self.replace_ollama_status("error", false, vec![], message),
        };
        if let Ok(models) = probe_ollama(endpoint) {
            let owned = self.0.lock().ok().is_some_and(|mut inner| {
                inner
                    .ollama_child
                    .as_mut()
                    .is_some_and(|child| child.try_wait().ok().flatten().is_none())
            });
            let message = if models.iter().any(|model| model == &configured_model) {
                "Ollama is ready and the configured model is installed."
            } else {
                "Ollama is ready. The configured model still requires explicit installation approval."
            };
            return self.replace_ollama_status(
                if owned { "started" } else { "available" },
                owned,
                models,
                message.into(),
            );
        }

        {
            let mut inner = match self.0.lock() {
                Ok(inner) => inner,
                Err(_) => {
                    return self.replace_ollama_status(
                        "error",
                        false,
                        vec![],
                        "Native service state is unavailable.".into(),
                    )
                }
            };
            if let Some(child) = inner.ollama_child.as_mut() {
                if child.try_wait().ok().flatten().is_none() {
                    return inner
                        .status
                        .clone()
                        .unwrap_or_else(NativeServiceStatus::checking);
                }
                inner.ollama_child = None;
            }
        }

        if port_reachable(endpoint) {
            return self.replace_ollama_status(
                "error",
                false,
                vec![],
                "The Ollama port is occupied but /api/tags is not healthy; no process was started."
                    .into(),
            );
        }

        let Some(executable) = find_ollama_executable() else {
            return self.replace_ollama_status(
                "not-installed",
                false,
                vec![],
                "Ollama is not installed. No process was started and no model was downloaded."
                    .into(),
            );
        };
        let child = match Command::new(executable)
            .arg("serve")
            .env("OLLAMA_HOST", endpoint.to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                return self.replace_ollama_status(
                    "error",
                    false,
                    vec![],
                    format!("Could not start ollama serve: {error}"),
                )
            }
        };
        if let Ok(mut inner) = self.0.lock() {
            inner.ollama_child = Some(child);
            let status = inner
                .status
                .get_or_insert_with(NativeServiceStatus::checking);
            status.ollama = "starting".into();
            status.owned = true;
            status.models.clear();
            status.configured_model = configured_model.clone();
            status.message = "Started ollama serve; waiting for its local API.".into();
        }

        let deadline = Instant::now() + Duration::from_secs(8);
        while Instant::now() < deadline {
            if let Ok(models) = probe_ollama(endpoint) {
                let message = if models.iter().any(|model| model == &configured_model) {
                    "The app started Ollama and the configured model is ready."
                } else {
                    "The app started Ollama. Model installation remains an explicit user action."
                };
                return self.replace_ollama_status("started", true, models, message.into());
            }
            thread::sleep(Duration::from_millis(250));
        }
        self.replace_ollama_status(
            "error",
            true,
            vec![],
            "ollama serve was started but its API did not become ready in time.".into(),
        )
    }

    fn replace_ollama_status(
        &self,
        ollama: &str,
        owned: bool,
        models: Vec<String>,
        message: String,
    ) -> NativeServiceStatus {
        let mut inner = match self.0.lock() {
            Ok(inner) => inner,
            Err(_) => return NativeServiceStatus::checking(),
        };
        let status = inner
            .status
            .get_or_insert_with(NativeServiceStatus::checking);
        status.ollama = ollama.into();
        status.owned = owned;
        status.models = models;
        status.configured_model = configured_model();
        status.message = message;
        status.clone()
    }

    fn refresh_local_ai(&self, app: &AppHandle) -> NativeServiceStatus {
        let endpoint = match local_endpoint(&configured_local_ai_host(), 8000) {
            Ok(endpoint) => endpoint,
            Err(message) => return self.replace_local_ai_status("error", false, message),
        };
        if probe_local_ai(endpoint).is_ok() {
            let owned = self
                .0
                .lock()
                .ok()
                .is_some_and(|inner| inner.local_ai_child.is_some());
            return self.replace_local_ai_status(
                if owned { "started" } else { "available" },
                owned,
                if owned {
                    "The packaged local-ai sidecar is ready."
                } else {
                    "Reusing an existing local-ai service; this app does not own it."
                }
                .into(),
            );
        }

        let already_started = self
            .0
            .lock()
            .ok()
            .is_some_and(|inner| inner.local_ai_child.is_some());
        if !already_started && port_reachable(endpoint) {
            return self.replace_local_ai_status(
                "error",
                false,
                "The local-ai port is occupied but /health is not healthy; no sidecar was started."
                    .into(),
            );
        }
        if !already_started {
            let sidecar = match app.shell().sidecar("chess-review-local-ai") {
                Ok(sidecar) => sidecar,
                Err(error) => {
                    return self.replace_local_ai_status(
                        "not-packaged",
                        false,
                        format!("The packaged local-ai sidecar is unavailable: {error}"),
                    )
                }
            };
            let (mut events, child) = match sidecar
                .env("LOCAL_AI_HOST", endpoint.ip().to_string())
                .env("LOCAL_AI_PORT", endpoint.port().to_string())
                .spawn()
            {
                Ok(process) => process,
                Err(error) => {
                    return self.replace_local_ai_status(
                        "not-packaged",
                        false,
                        format!("Could not start the packaged local-ai sidecar: {error}"),
                    )
                }
            };
            let pid = child.pid();
            if let Ok(mut inner) = self.0.lock() {
                inner.local_ai_child = Some(child);
            }
            let services = self.clone();
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = events.recv().await {
                    if matches!(event, CommandEvent::Terminated(_)) {
                        if let Some(status) = services.local_ai_exited(pid) {
                            let _ = app_handle.emit(SERVICES_CHANGED_EVENT, status);
                        }
                        break;
                    }
                }
            });
            self.replace_local_ai_status(
                "starting",
                true,
                "Started the packaged local-ai sidecar; waiting for its health endpoint.".into(),
            );
        }

        let deadline = Instant::now() + Duration::from_secs(30);
        while Instant::now() < deadline {
            if probe_local_ai(endpoint).is_ok() {
                return self.replace_local_ai_status(
                    "started",
                    true,
                    "The packaged local-ai sidecar is ready.".into(),
                );
            }
            thread::sleep(Duration::from_millis(250));
        }
        self.replace_local_ai_status(
            "error",
            true,
            "The packaged local-ai sidecar did not become ready in time.".into(),
        )
    }

    fn replace_local_ai_status(
        &self,
        local_ai: &str,
        owned: bool,
        message: String,
    ) -> NativeServiceStatus {
        let mut inner = match self.0.lock() {
            Ok(inner) => inner,
            Err(_) => return NativeServiceStatus::checking(),
        };
        let status = inner
            .status
            .get_or_insert_with(NativeServiceStatus::checking);
        status.local_ai = local_ai.into();
        status.local_ai_owned = owned;
        status.local_ai_message = message;
        status.clone()
    }

    fn local_ai_exited(&self, pid: u32) -> Option<NativeServiceStatus> {
        let Ok(mut inner) = self.0.lock() else {
            return None;
        };
        if inner
            .local_ai_child
            .as_ref()
            .is_some_and(|child| child.pid() == pid)
        {
            inner.local_ai_child = None;
            let status = inner
                .status
                .get_or_insert_with(NativeServiceStatus::checking);
            status.local_ai = "error".into();
            status.local_ai_owned = false;
            status.local_ai_message = "The packaged local-ai sidecar exited.".into();
            return Some(status.clone());
        }
        None
    }

    pub(crate) fn shutdown_owned(&self) {
        let (ollama, local_ai) = self
            .0
            .lock()
            .map(|mut inner| (inner.ollama_child.take(), inner.local_ai_child.take()))
            .unwrap_or((None, None));
        if let Some(mut child) = ollama {
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Some(child) = local_ai {
            let _ = child.kill();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_loopback_ollama_hosts() {
        assert!(local_endpoint("127.0.0.1:11434", 11434).is_ok());
        assert!(local_endpoint("http://localhost:11434", 11434).is_ok());
        assert!(local_endpoint("http://192.0.2.10:11434", 11434).is_err());
    }

    #[test]
    fn parses_and_orders_the_ollama_model_catalog() {
        let parsed: OllamaTags =
            serde_json::from_str(r#"{"models":[{"name":"z-model"},{"name":"a-model"}]}"#)
                .expect("parse model fixture");
        let mut names = parsed
            .models
            .into_iter()
            .map(|model| model.name)
            .collect::<Vec<_>>();
        names.sort();
        assert_eq!(names, ["a-model", "z-model"]);
    }
}
