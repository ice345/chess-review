use serde::Serialize;
use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

mod native_services;
use native_services::{NativeServiceStatus, NativeServices, SERVICES_CHANGED_EVENT};

const MAX_PGN_BYTES: u64 = 10 * 1024 * 1024;
const PGN_OPENED_EVENT: &str = "desktop://pgn-opened";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PgnDocument {
    file_name: String,
    contents: String,
}

#[derive(Default)]
struct PendingPgn(Mutex<Option<PgnDocument>>);

fn is_pgn_path(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pgn"))
}

fn read_pgn_path(path: &Path) -> Result<PgnDocument, String> {
    if !is_pgn_path(path) {
        return Err("Only .pgn files can be opened.".into());
    }
    let metadata =
        fs::metadata(path).map_err(|error| format!("Could not inspect the PGN: {error}"))?;
    if !metadata.is_file() {
        return Err("The selected PGN is not a regular file.".into());
    }
    if metadata.len() > MAX_PGN_BYTES {
        return Err("The selected PGN is larger than 10 MiB.".into());
    }
    let bytes = fs::read(path).map_err(|error| format!("Could not read the PGN: {error}"))?;
    let contents =
        String::from_utf8(bytes).map_err(|_| "The selected PGN is not UTF-8 text.".to_string())?;
    let file_name = path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("opened-game.pgn")
        .to_string();
    Ok(PgnDocument {
        file_name,
        contents,
    })
}

fn first_pgn_from_paths<I>(paths: I) -> Option<PgnDocument>
where
    I: IntoIterator<Item = PathBuf>,
{
    paths.into_iter().find_map(|path| read_pgn_path(&path).ok())
}

fn deliver_pgn(app: &tauri::AppHandle, document: PgnDocument) {
    if let Ok(mut pending) = app.state::<PendingPgn>().0.lock() {
        *pending = Some(document.clone());
    }
    let _ = app.emit(PGN_OPENED_EVENT, document);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
async fn open_pgn_dialog(app: tauri::AppHandle) -> Result<Option<PgnDocument>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Portable Game Notation", &["pgn"])
        .blocking_pick_file();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|_| "The selected item is not a local filesystem path.".to_string())?;
    read_pgn_path(&path).map(Some)
}

#[tauri::command]
fn take_pending_pgn(pending: State<'_, PendingPgn>) -> Option<PgnDocument> {
    pending.0.lock().ok()?.take()
}

#[tauri::command]
fn native_service_status(services: State<'_, NativeServices>) -> NativeServiceStatus {
    services.status()
}

#[tauri::command]
async fn refresh_native_services(
    app: tauri::AppHandle,
    services: State<'_, NativeServices>,
) -> Result<NativeServiceStatus, String> {
    let owned = services.inner().clone();
    let app_handle = app.clone();
    Ok(
        tauri::async_runtime::spawn_blocking(move || owned.start_or_refresh(&app_handle))
            .await
            .map_err(|error| format!("Could not refresh native services: {error}"))?,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // This plugin must be registered first. Windows/Linux deliver a file
        // opened on an already-running app as argv from the second instance.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = argv.into_iter().skip(1).map(PathBuf::from);
            if let Some(document) = first_pgn_from_paths(paths) {
                deliver_pgn(app, document);
            }
        }));
    }

    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(PendingPgn::default())
        .manage(NativeServices::default())
        .invoke_handler(tauri::generate_handler![
            open_pgn_dialog,
            take_pending_pgn,
            native_service_status,
            refresh_native_services
        ])
        .setup(|app| {
            let startup_paths = std::env::args_os().skip(1).map(PathBuf::from);
            if let Some(document) = first_pgn_from_paths(startup_paths) {
                deliver_pgn(app.handle(), document);
            }
            let services = app.state::<NativeServices>().inner().clone();
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let status = services.start_or_refresh(&app_handle);
                let _ = app_handle.emit(SERVICES_CHANGED_EVENT, status);
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Open Chess Review");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = &event {
            let paths = urls.iter().filter_map(|url| url.to_file_path().ok());
            if let Some(document) = first_pgn_from_paths(paths) {
                deliver_pgn(app_handle, document);
            }
        }
        if matches!(event, tauri::RunEvent::Exit) {
            app_handle.state::<NativeServices>().shutdown_owned();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_pgn_extensions_case_insensitively() {
        assert!(is_pgn_path(Path::new("game.pgn")));
        assert!(is_pgn_path(Path::new("GAME.PGN")));
        assert!(!is_pgn_path(Path::new("game.txt")));
    }

    #[test]
    fn selects_the_first_readable_pgn_path() {
        let test_dir =
            std::env::temp_dir().join(format!("open-chess-review-{}", std::process::id()));
        fs::create_dir_all(&test_dir).expect("create test directory");
        let text_path = test_dir.join("ignored.txt");
        let pgn_path = test_dir.join("accepted.pgn");
        fs::write(&text_path, "not a PGN path").expect("write text fixture");
        fs::write(&pgn_path, "1. e4 e5 *").expect("write PGN fixture");

        let document =
            first_pgn_from_paths([text_path.clone(), pgn_path.clone()]).expect("read PGN");

        assert_eq!(document.file_name, "accepted.pgn");
        assert_eq!(document.contents, "1. e4 e5 *");
        fs::remove_file(text_path).expect("remove text fixture");
        fs::remove_file(pgn_path).expect("remove PGN fixture");
        fs::remove_dir(test_dir).expect("remove test directory");
    }
}
