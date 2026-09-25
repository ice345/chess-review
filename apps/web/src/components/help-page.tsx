"use client";

import Link from "next/link";
import type { UiLanguage } from "@chess-review/shared";
import { FEEDBACK_URL, PROJECT_URL } from "../lib/site-info";
import { REVIEW_SHORTCUT_GROUPS, shortcutGroupLabel, shortcutKeysLabel, shortcutLabel, shortcutsInGroup } from "../lib/review-shortcuts";
import { useUiLanguage } from "../hooks/use-ui-language";

type HelpCopy = {
  kicker: string;
  title: string;
  lede: string;
  navAria: string;
  navFirstReview: string;
  navCapabilities: string;
  navShortcuts: string;
  navYourData: string;
  navEnhancedLocal: string;
  navFeedback: string;
  firstReviewHeading: string;
  firstReview1Link: string;
  firstReview1After: string;
  firstReview2: string;
  firstReview3: string;
  firstReview4Before: string;
  practice: string;
  firstReview4After: string;
  firstReview5Before: string;
  settingsBackupLink: string;
  firstReview5After: string;
  capabilitiesHeading: string;
  browserCore: string;
  browserCoreBody: string;
  enhancedLocal: string;
  enhancedLocalBody: string;
  capabilitiesRoles: string;
  capabilitiesFen: string;
  shortcutsHeading: string;
  shortcutsBeforeKbd: string;
  shortcutsAfterKbd: string;
  yourDataHeading: string;
  dtGames: string;
  ddGames: string;
  dtBackup: string;
  ddBackup: string;
  dtChesscom: string;
  ddChesscom: string;
  dtLichess: string;
  ddLichessBefore: string;
  lichessAccountSettings: string;
  ddLichessAfter: string;
  dtAvatars: string;
  ddAvatars: string;
  dtMaia: string;
  ddMaia: string;
  dtApiCoach: string;
  ddApiCoach: string;
  dtExplorer: string;
  ddExplorer: string;
  dtTablebase: string;
  ddTablebase: string;
  dtWebsite: string;
  ddWebsite: string;
  dataFooter: string;
  enhancedSetupHeading: string;
  enhancedSetupBefore: string;
  followSetupGuide: string;
  enhancedSetupAfter: string;
  setupLi1Before: string;
  setupLi1Between1: string;
  setupLi1Between2: string;
  setupLi1After: string;
  setupLi2: string;
  setupLi3: string;
  setupLi4: string;
  enhancedSetupFooter: string;
  recoveryHeading: string;
  recovery1: string;
  recovery2: string;
  recovery3: string;
  recovery4: string;
  feedbackHeading: string;
  feedbackBody: string;
  openBugReport: string;
  feedbackFooter: string;
};

const COPY: Record<UiLanguage, HelpCopy> = {
  en: {
    kicker: "Using Open Chess Review",
    title: "Help and data privacy",
    lede: "A free, open-source personal review and coaching workspace. Start with a game, understand a decision, and return to it later.",
    navAria: "Help topics",
    navFirstReview: "First review",
    navCapabilities: "Capabilities",
    navShortcuts: "Review shortcuts",
    navYourData: "Your data",
    navEnhancedLocal: "Enhanced Local",
    navFeedback: "Feedback",
    firstReviewHeading: "Your first review",
    firstReview1Link: "Import a PGN file, paste PGN/FEN, or open the example game.",
    firstReview1After: "Multi-game PGNs let you choose a game before importing.",
    firstReview2: "Choose Analyze game. Browser Stockfish builds the review; you can cancel and retry. A saved game is only labelled analyzed when a compatible complete result exists.",
    firstReview3: "Open a key decision, inspect its move evidence and explore continuations. Open Notebook to save a personal note, bookmark or line through the selected position. Return to the game to leave a temporary exploration branch.",
    firstReview4Before: "Visit ",
    practice: "Practice",
    firstReview4After: " to return to decisions from your own games. Add a task, start its source position, and say what each review was worth. Continue picks up whatever the schedule is waiting for, otherwise the first position you have not reviewed yet.",
    firstReview5Before: "Use ",
    settingsBackupLink: "Settings → Local data → Library backup",
    firstReview5After: " before changing browsers or clearing site data. A review URL alone does not transfer a game to another browser.",
    capabilitiesHeading: "What is available",
    browserCore: "Browser Core",
    browserCoreBody: " provides PGN/FEN, Stockfish, move review, Accuracy, opening and phase information, charts, deterministic summaries, exports, saved position reviews, personal notebooks and library backup. No AI installation is required. This beta has no Open Chess Review sign-in, cloud library sync, online play or paid subscription.",
    enhancedLocal: "Enhanced Local",
    enhancedLocalBody: " adds Maia human predictions and optional generative explanations through a service on your own computer. The public website does not provide hosted AI and does not connect to your computer's AI service.",
    capabilitiesRoles: "Stockfish supplies objective evaluations. Maia predicts human choices; it is not an objective evaluator. The Coach explains structured evidence and cannot override it. A position-review count is a ledger of the source positions you have gone through, not a score. Practice mastery is separate: each position follows a due date, and it only advances when you produce the move unaided on a day the position came round again. Neither number is an Elo measurement.",
    capabilitiesFen: "FEN studies have no game history, so use Engine Lab for position analysis. PGN is required for whole-game Accuracy and move-review history. Engine Lab also carries the Opening Explorer, which looks up what other players do from the current position in a public lichess.org database, and Tablebase, which reports the proven result for positions of at most seven pieces.",
    shortcutsHeading: "Review shortcuts",
    shortcutsBeforeKbd: "These work anywhere in Review unless you are typing in a field or a control owns the keys. Press ",
    shortcutsAfterKbd: " inside a review to open the same list without leaving the board.",
    yourDataHeading: "Your data and connected services",
    dtGames: "Games and progress",
    ddGames: "PGN/FEN, completed analysis, imported games, review tasks, saved notebooks and cached avatar URLs are stored in this browser's IndexedDB. Preferences use localStorage. Other devices and browsers do not receive a copy automatically. Clearing browser data or private-browsing storage can remove this library.",
    dtBackup: "Backup files",
    ddBackup: "JSON backups contain games, FEN studies, original PGN where present, settings, saved review progress and notebooks (notes, bookmarks and legal lines). Backup v2 includes notebooks and accepts older v1 files. Unsaved drafts are excluded. Restore validates the entire file and previews duplicate/conflict handling. It excludes accounts, OAuth sessions, credentials, derived analysis caches, generated lessons, avatars and running job logs. Keep the file somewhere you control; it contains game and player information.",
    dtChesscom: "Chess.com",
    ddChesscom: "Linking a public username requests its public profile and games through this website's server. This does not verify account ownership and is not a Chess.com login. Website requests can include the username and sync checkpoint.",
    dtLichess: "Lichess",
    ddLichessBefore: "When this deployment offers sign-in, you authorize directly on lichess.org using PKCE. The access token is held in an encrypted HttpOnly cookie and used server-side to retrieve your account and games. It is excluded from library backups. Disconnect clears this browser's session and attempts remote revocation; if Lichess cannot confirm it, revoke the application in ",
    lichessAccountSettings: "Lichess account settings",
    ddLichessAfter: ".",
    dtAvatars: "Player avatars",
    ddAvatars: "Recognized Chess.com/Lichess game metadata may trigger public profile lookups through this website. Your browser then loads an allowlisted platform image directly. Those services receive the relevant network request.",
    dtMaia: "Maia and local coaching",
    ddMaia: "Enhanced Local sends selected positions, candidate moves and target Elo to your local service. Coach requests send structured facts; a game summary includes game headers, player names and move data. Local Ollama handles those facts on your machine.",
    dtApiCoach: "Optional API coaching",
    ddApiCoach: "Only in Enhanced Local, choosing an API provider and requesting a lesson forwards those structured facts through your local gateway to its configured provider. The provider's retention and account settings apply. Provider keys belong in that gateway's server configuration. No lesson is requested automatically for each move.",
    dtExplorer: "Opening Explorer",
    ddExplorer: "When you open the Explorer panel in Engine Lab, the current position, the chosen database and the chosen population (rating floor and speeds) are sent to lichess.org\u2019s public opening explorer through this website\u2019s server, and the answer is cached in this browser. No game, PGN, username or account identifier leaves this machine, and the panel says so before you use it. The explorer has required an API token since March 2026, so this deployment needs one configured; without it the panel says the lookup is unconfigured instead of failing silently. Clearing the analysis cache also clears that cache.",
    dtTablebase: "Tablebase",
    ddTablebase: "When you open the Tablebase panel in Engine Lab for a position of at most seven pieces, that position is sent to the public Syzygy tables through this website\u2019s server, and the answer is cached in this browser. Only the position leaves this machine. A position above the coverage limit is never sent, and no engine evaluation is presented as a proven result. Clearing the analysis cache also clears that cache.",
    dtWebsite: "Website requests",
    ddWebsite: "The host receives page/API requests, IP address and normal request metadata. Platform sync passes game responses through the server; this app has no server database for your library. Hosting access logs may retain request metadata. Application feedback is sent only when you submit it yourself.",
    dataFooter: "Delete review removes its local references, notebook and progress. Clear analysis cache keeps your original games; Reset all local data removes the local library and preferences. Disconnecting a platform lets you keep imported games or delete their linked data. Use a backup first when you want a recoverable copy.",
    enhancedSetupHeading: "Enhanced Local setup",
    enhancedSetupBefore: "This optional workflow is for a local checkout on your computer. ",
    followSetupGuide: "Follow the project setup guide",
    enhancedSetupAfter: " to install its prerequisites.",
    setupLi1Before: "Run ",
    setupLi1Between1: " from the repository for the managed local workspace. Use ",
    setupLi1Between2: " for the web app alone; ",
    setupLi1After: " starts only optional services.",
    setupLi2: "Open the localhost address printed by the launcher, then Settings → Local enhancements. It distinguishes an unreachable service, an uninstalled model and a ready provider.",
    setupLi3: "Select an installed Ollama model. Missing models require your explicit download action; the launcher never pulls one automatically. Maia downloads also require the Download model button.",
    setupLi4: "For API coaching, configure the provider on the local gateway before selecting it in Settings. API credentials are never entered into a public website bundle.",
    enhancedSetupFooter: "The browser cannot start native processes. A missing model or unreachable local service does not block Browser Core. This release supports local loopback enhancement addresses; an arbitrary remote AI URL is not a hosted service configuration.",
    recoveryHeading: "If something stops working",
    recovery1: "Storage upgrade waiting: close other tabs for this website, then reload. For a storage error, enable site storage and retry; avoid clearing data before exporting a backup.",
    recovery2: "Restore preview changed: another tab saved data. Refresh the preview and inspect its conflicts before restoring.",
    recovery3: "Sync paused or rate limited: wait for the indicated retry time, then resume from the saved checkpoint. Reconnect if your Lichess session expired.",
    recovery4: "Analysis interrupted: keep the source game in History, close unnecessary analysis work and retry. Deeper analysis can take longer.",
    feedbackHeading: "Report a problem",
    feedbackBody: "Include the page, what you expected, what happened, browser/version and steps to reproduce. Add a minimal example game only if you want to share it. Reports on GitHub are public; keep tokens, cookies and personal backup files out of the issue.",
    openBugReport: "Open a bug report →",
    feedbackFooter: "Review the report before submitting it. Nothing is sent automatically.",
  },
  "zh-CN": {
    kicker: "使用 Open Chess Review",
    title: "帮助与数据隐私",
    lede: "免费、开源的个人复盘与讲解工作区。从一盘棋开始，理解一个决策，以后再回来看。",
    navAria: "帮助主题",
    navFirstReview: "第一次复盘",
    navCapabilities: "能力",
    navShortcuts: "复盘快捷键",
    navYourData: "你的数据",
    navEnhancedLocal: "本地增强",
    navFeedback: "反馈",
    firstReviewHeading: "你的第一次复盘",
    firstReview1Link: "导入 PGN 文件、粘贴 PGN/FEN，或打开示例对局。",
    firstReview1After: "多局 PGN 可以在导入前选择一盘。",
    firstReview2: "选择「分析对局」。浏览器中的 Stockfish 会生成复盘；你可以取消并重试。已保存的对局只有在存在兼容的完整结果时才会标记为已分析。",
    firstReview3: "打开一个关键决策，查看其着法证据并探索后续变化。打开笔记，为所选局面保存个人注释、书签或变化。返回对局即可离开临时探索分支。",
    firstReview4Before: "前往",
    practice: "训练",
    firstReview4After: "，回到你自己对局中的决策。添加任务，从其源局面开始，并判断每次复盘的价值。「继续」会接上日程正在等待的项，否则从你尚未复习的第一个局面开始。",
    firstReview5Before: "更换浏览器或清除站点数据前，请使用",
    settingsBackupLink: "设置 → 本地数据 → 棋库备份",
    firstReview5After: "。仅有复盘网址并不能把对局转到另一个浏览器。",
    capabilitiesHeading: "有哪些功能",
    browserCore: "浏览器核心",
    browserCoreBody: "提供 PGN/FEN、Stockfish、着法复盘、准确率、开局与阶段信息、图表、确定性总结、导出、已保存的局面复习、个人笔记和棋库备份。无需安装 AI。此测试版没有 Open Chess Review 登录、云端棋库同步、在线对弈或付费订阅。",
    enhancedLocal: "本地增强",
    enhancedLocalBody: "通过你自己电脑上的服务，加入 Maia 人类预测和可选的生成式讲解。公开网站不提供托管 AI，也不会连接到你电脑上的 AI 服务。",
    capabilitiesRoles: "Stockfish 提供客观评分。Maia 预测人类选择，它不是客观评估器。讲解基于结构化证据，不能覆盖证据。局面复习次数是你走过的源局面台账，不是分数。训练掌握度是另一回事：每个局面有到期日，只有在该局面再次轮到、且你独立走出那步时才会推进。这两个数字都不是 Elo。",
    capabilitiesFen: "FEN 研究没有对局历史，请用引擎实验室做局面分析。整局准确率和着法复盘历史需要 PGN。引擎实验室还带有开局探索器（在公开的 lichess.org 数据库中查找当前局面其他人怎么走）和残局库（报告至多七个棋子局面的已证明结果）。",
    shortcutsHeading: "复盘快捷键",
    shortcutsBeforeKbd: "除非你正在输入框里打字，或某个控件占用了按键，这些快捷键在复盘各处都有效。在复盘中按 ",
    shortcutsAfterKbd: " 即可打开同一份列表，无需离开棋盘。",
    yourDataHeading: "你的数据与已连接服务",
    dtGames: "对局与进度",
    ddGames: "PGN/FEN、已完成的分析、导入的对局、复盘任务、已保存的笔记和缓存的头像网址，都存在这个浏览器的 IndexedDB 里。偏好使用 localStorage。其他设备和浏览器不会自动收到副本。清除浏览器数据或无痕浏览存储可能删掉这份棋库。",
    dtBackup: "备份文件",
    ddBackup: "JSON 备份包含对局、FEN 研究、原始 PGN（如有）、设置、已保存的复盘进度和笔记（注释、书签和合法变化）。备份 v2 包含笔记，并接受较旧的 v1 文件。未保存的草稿不包含在内。恢复会校验整个文件，并预览重复/冲突处理。它不包含账户、OAuth 会话、凭证、派生分析缓存、生成的讲解、头像和正在运行的任务日志。请把文件放在你能控制的地方；其中含有对局和棋手信息。",
    dtChesscom: "Chess.com",
    ddChesscom: "关联公开用户名会通过本网站的服务器请求其公开资料和对局。这不验证账户所有权，也不是 Chess.com 登录。网站请求可能包含用户名和同步检查点。",
    dtLichess: "Lichess",
    ddLichessBefore: "当此部署提供登录时，你会在 lichess.org 上用 PKCE 直接授权。访问令牌保存在加密的 HttpOnly cookie 中，由服务器用来获取你的账户和对局。它不包含在棋库备份里。断开连接会清除此浏览器的会话并尝试远程撤销；如果 Lichess 无法确认，请在 ",
    lichessAccountSettings: "Lichess 账户设置",
    ddLichessAfter: " 中撤销该应用。",
    dtAvatars: "棋手头像",
    ddAvatars: "识别到的 Chess.com/Lichess 对局元数据可能通过本网站触发公开资料查询。随后浏览器会直接加载允许名单中的平台图片。这些服务会收到相应的网络请求。",
    dtMaia: "Maia 与本地讲解",
    ddMaia: "本地增强会把选定局面、候选着法和目标 Elo 发到你的本地服务。讲解请求发送结构化事实；整局总结包含棋头、棋手姓名和着法数据。本地 Ollama 在你的机器上处理这些事实。",
    dtApiCoach: "可选 API 讲解",
    ddApiCoach: "仅在本地增强中，选择 API 提供方并请求讲解时，才会把这些结构化事实经你的本地网关转发到其配置的提供方。适用该提供方的留存与账户设置。提供方密钥应放在该网关的服务器配置中。不会为每一步自动请求讲解。",
    dtExplorer: "开局探索器",
    ddExplorer: "当你在引擎实验室打开开局探索器面板时，当前局面、所选数据库和所选群体（等级分下限和速度）会经本网站服务器发往 lichess.org 的公开开局探索器，答案缓存在这个浏览器里。没有对局、PGN、用户名或账户标识会离开本机，面板在你使用前会说明这一点。该探索器自 2026 年 3 月起需要 API 令牌，因此此部署需要配置一个；没有令牌时，面板会提示查找未配置，而不是静默失败。清除分析缓存也会清除该缓存。",
    dtTablebase: "残局库",
    ddTablebase: "当你在引擎实验室为至多七个棋子的局面打开残局库面板时，该局面会经本网站服务器发往公开的 Syzygy 残局表，答案缓存在这个浏览器里。只有局面会离开本机。超出覆盖范围的局面绝不会发送，也不会把引擎评分当作已证明结果。清除分析缓存也会清除该缓存。",
    dtWebsite: "网站请求",
    ddWebsite: "主机收到页面/API 请求、IP 地址和常规请求元数据。平台同步会把对局响应经过服务器；本应用没有存放你棋库的服务器数据库。托管访问日志可能保留请求元数据。应用反馈只有在你自己提交时才会发送。",
    dataFooter: "删除复盘会去掉其本地引用、笔记和进度。清除分析缓存会保留原始对局；重置全部本地数据会删除本地棋库和偏好。断开平台连接时，你可以保留已导入的对局，或删除其关联数据。若需要可恢复的副本，请先做备份。",
    enhancedSetupHeading: "本地增强设置",
    enhancedSetupBefore: "这套可选流程用于你电脑上的本地检出。",
    followSetupGuide: "按照项目设置指南",
    enhancedSetupAfter: "安装其前置条件。",
    setupLi1Before: "在仓库中运行 ",
    setupLi1Between1: " 以启动托管的本地工作区。只用网页应用请用 ",
    setupLi1Between2: "； ",
    setupLi1After: " 只启动可选服务。",
    setupLi2: "打开启动器打印的 localhost 地址，然后到设置 → 本地增强。它会区分无法访问的服务、未安装的模型和已就绪的提供方。",
    setupLi3: "选择已安装的 Ollama 模型。缺少的模型需要你明确执行下载；启动器绝不会自动拉取。Maia 下载也需要「下载模型」按钮。",
    setupLi4: "若使用 API 讲解，请先在本地网关上配置提供方，再在设置中选择它。API 凭证绝不会填入公开网站的前端包。",
    enhancedSetupFooter: "浏览器无法启动本地进程。缺少模型或无法访问本地服务并不会挡住浏览器核心。此版本支持本地回环增强地址；任意远程 AI 网址不是托管服务配置。",
    recoveryHeading: "如果出了问题",
    recovery1: "存储升级等待中：关闭本网站的其他标签页，然后重新加载。若出现存储错误，请启用站点存储并重试；导出备份前不要清除数据。",
    recovery2: "恢复预览已变化：另一个标签页保存了数据。请刷新预览并检查冲突后再恢复。",
    recovery3: "同步已暂停或受到速率限制：等到所示的重试时间，然后从已保存的检查点继续。若 Lichess 会话已过期，请重新连接。",
    recovery4: "分析被打断：把源对局留在棋库里，关掉不必要的分析工作并重试。更深的分析可能更久。",
    feedbackHeading: "报告问题",
    feedbackBody: "请写明页面、你期望发生的事、实际发生的事、浏览器/版本和复现步骤。只有在你愿意分享时才附上最小示例对局。GitHub 上的报告是公开的；不要把令牌、cookie 和个人备份文件放进工单。",
    openBugReport: "打开缺陷报告 →",
    feedbackFooter: "提交前请检查报告。不会自动发送任何内容。",
  },
};

export function HelpPage() {
  const language = useUiLanguage();
  const copy = COPY[language];
  return <main className="page-scroll utility-page">
    <section className="page-head head-instrument"><p className="page-kicker">{copy.kicker}</p><h1 className="page-display">{copy.title}</h1><p className="page-lede">{copy.lede}</p></section>

    <article className="help-content">
      <nav aria-label={copy.navAria}><a href="#first-review">{copy.navFirstReview}</a><a href="#capabilities">{copy.navCapabilities}</a><a href="#shortcuts">{copy.navShortcuts}</a><a href="#your-data">{copy.navYourData}</a><a href="#enhanced-local">{copy.navEnhancedLocal}</a><a href="#feedback">{copy.navFeedback}</a></nav>
      <section id="first-review"><h2>{copy.firstReviewHeading}</h2><ol>
        <li><Link href="/">{copy.firstReview1Link}</Link> {copy.firstReview1After}</li>
        <li>{copy.firstReview2}</li>
        <li>{copy.firstReview3}</li>
        <li>{copy.firstReview4Before}<Link href="/training">{copy.practice}</Link>{copy.firstReview4After}</li>
        <li>{copy.firstReview5Before}<Link href="/settings">{copy.settingsBackupLink}</Link>{copy.firstReview5After}</li>
      </ol></section>
      <section id="capabilities"><h2>{copy.capabilitiesHeading}</h2>
        <p><strong>{copy.browserCore}</strong>{copy.browserCoreBody}</p>
        <p><strong>{copy.enhancedLocal}</strong>{copy.enhancedLocalBody}</p>
        <p>{copy.capabilitiesRoles}</p>
        <p>{copy.capabilitiesFen}</p>
      </section>
      <section id="shortcuts"><h2>{copy.shortcutsHeading}</h2>
        <p>{copy.shortcutsBeforeKbd}<kbd>?</kbd>{copy.shortcutsAfterKbd}</p>
        {REVIEW_SHORTCUT_GROUPS.map((group) => (
          <div className="help-shortcut-group" key={group}>
            <h3>{shortcutGroupLabel(group, language)}</h3>
            <dl>{shortcutsInGroup(group).map((shortcut) => (
              <div key={shortcut.action}><dt><kbd>{shortcutKeysLabel(shortcut, language)}</kbd></dt><dd>{shortcutLabel(shortcut, language)}</dd></div>
            ))}</dl>
          </div>
        ))}
      </section>
      <section id="your-data"><h2>{copy.yourDataHeading}</h2>
        <dl className="data-destinations">
          <div><dt>{copy.dtGames}</dt><dd>{copy.ddGames}</dd></div>
          <div><dt>{copy.dtBackup}</dt><dd>{copy.ddBackup}</dd></div>
          <div><dt>{copy.dtChesscom}</dt><dd>{copy.ddChesscom}</dd></div>
          <div><dt>{copy.dtLichess}</dt><dd>{copy.ddLichessBefore}<a href="https://lichess.org/account/oauth/token" rel="noreferrer">{copy.lichessAccountSettings}</a>{copy.ddLichessAfter}</dd></div>
          <div><dt>{copy.dtAvatars}</dt><dd>{copy.ddAvatars}</dd></div>
          <div><dt>{copy.dtMaia}</dt><dd>{copy.ddMaia}</dd></div>
          <div><dt>{copy.dtApiCoach}</dt><dd>{copy.ddApiCoach}</dd></div>
          <div><dt>{copy.dtExplorer}</dt><dd>{copy.ddExplorer}</dd></div>
          <div><dt>{copy.dtTablebase}</dt><dd>{copy.ddTablebase}</dd></div>
          <div><dt>{copy.dtWebsite}</dt><dd>{copy.ddWebsite}</dd></div>
        </dl>
        <p>{copy.dataFooter}</p>
      </section>
      <section id="enhanced-local"><h2>{copy.enhancedSetupHeading}</h2>
        <p>{copy.enhancedSetupBefore}<a href={`${PROJECT_URL}#readme`} rel="noreferrer">{copy.followSetupGuide}</a>{copy.enhancedSetupAfter}</p>
        <ol><li>{copy.setupLi1Before}<code>pnpm dev</code>{copy.setupLi1Between1}<code>pnpm dev:web</code>{copy.setupLi1Between2}<code>pnpm dev:local-ai</code>{copy.setupLi1After}</li><li>{copy.setupLi2}</li><li>{copy.setupLi3}</li><li>{copy.setupLi4}</li></ol>
        <p>{copy.enhancedSetupFooter}</p>
      </section>
      <section id="recovery"><h2>{copy.recoveryHeading}</h2><ul><li>{copy.recovery1}</li><li>{copy.recovery2}</li><li>{copy.recovery3}</li><li>{copy.recovery4}</li></ul></section>
      <section id="feedback"><h2>{copy.feedbackHeading}</h2><p>{copy.feedbackBody}</p><a className="primary-link" href={FEEDBACK_URL} rel="noreferrer">{copy.openBugReport}</a><p>{copy.feedbackFooter}</p></section>
    </article>
  </main>;
}
