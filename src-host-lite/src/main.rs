use axum::{
  extract::{Query, State},
  http::StatusCode,
  response::IntoResponse,
  routing::{get, post},
  Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::{Path, PathBuf}, time::Duration};
use tokio::{fs, process::Command, time::timeout};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use axum::http::{Method, header};
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

#[derive(Clone)]
struct AppState { roots: Vec<PathBuf> }

#[derive(Deserialize)]
struct ReadQ { path: String }

#[derive(Deserialize)]
struct RunSpec {
  cmd: String,
  args: Vec<String>,
  #[serde(default)]
  dry_run: bool
}
#[derive(Deserialize)]
struct RunReq { spec: RunSpec }

#[derive(Serialize)]
struct RunRes { dry_run: bool, status: i32, stdout: String, stderr: String }

#[derive(Serialize)]
struct Config { version: &'static str, base: String, capabilities: Value }

async fn config() -> impl IntoResponse {
  axum::Json(Config {
    version: env!("CARGO_PKG_VERSION"),
    base: "http://127.0.0.1:7345".into(),
    capabilities: serde_json::json!({ "git": true, "gh": true, "fs": true, "run": true }),
  })
}

fn under_root(p: &Path, roots: &[PathBuf]) -> bool {
  let Ok(cwd) = std::env::current_dir() else { return false; };
  let Ok(abs) = cwd.join(p).canonicalize() else { return false; };
  roots.iter().any(|r| {
    match cwd.join(r).canonicalize() {
      Ok(root) => abs.starts_with(&root),
      Err(_) => false,
    }
  })
}

#[tokio::main]
async fn main() {
  // minimal tracing
  let subscriber = FmtSubscriber::builder().with_max_level(Level::INFO).finish();
  let _ = tracing::subscriber::set_global_default(subscriber);

  let state = AppState {
    // conservative allowlist: project dirs only
    roots: vec![
      PathBuf::from("."),
      PathBuf::from("ade"),
      PathBuf::from("kit"),
      PathBuf::from("src"),
      PathBuf::from("scripts"),
    ],
  };

  let app = Router::new()
    .route("/healthz", get(|| async { "ok" }))
    .route("/version", get(|| async { env!("CARGO_PKG_VERSION") }))
    .route("/.well-known/ade.json", get(config))
    .route("/read_text_rel", get(read_text_rel))
    .route("/run", post(run))
    .with_state(state)
    .layer(cors_layer())
    .layer(TraceLayer::new_for_http());

  let addr = std::net::SocketAddr::from((
    [127,0,0,1],
    std::env::var("ADE_HOST_LITE_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(7345)
  ));
  let listener = match tokio::net::TcpListener::bind(addr).await {
    Ok(l) => l,
    Err(e) => { error!("host-lite bind failed on {}: {}", addr, e); std::process::exit(1); }
  };
  info!("host-lite listening on http://{}", addr);
  // graceful shutdown on Ctrl+C
  let server = axum::serve(listener, app).with_graceful_shutdown(async {
    let _ = tokio::signal::ctrl_c().await;
    info!("host-lite shutting down");
  });
  if let Err(e) = server.await {
    error!("host-lite server error: {}", e);
    std::process::exit(1);
  }
}

fn cors_layer() -> CorsLayer {
  // Allow comma-separated origins in env; else default common dev origins.
  if std::env::var("ADE_HOST_LITE_PERMISSIVE_CORS").as_deref() == Ok("1") {
    return CorsLayer::very_permissive();
  }
  let mut origins: Vec<axum::http::HeaderValue> = vec![];
  if let Ok(s) = std::env::var("ADE_HOST_LITE_ORIGINS") {
    for o in s.split(',').map(|x| x.trim()).filter(|x| !x.is_empty()) {
      if let Ok(v) = o.parse() { origins.push(v); }
    }
  }
  if origins.is_empty() {
    origins = vec![
      "http://127.0.0.1:5173".parse().unwrap(),
      "http://localhost:5173".parse().unwrap(),
      "http://wsl.localhost:5173".parse().unwrap(),
    ];
  }
  CorsLayer::new()
    .allow_origin(origins)
    .allow_methods([Method::GET, Method::POST])
    .allow_headers([header::CONTENT_TYPE])
}
async fn read_text_rel(State(st): State<AppState>, Query(q): Query<ReadQ>) -> impl IntoResponse {
  let rel = PathBuf::from(q.path);
  if !under_root(&rel, &st.roots) {
    return (StatusCode::BAD_REQUEST, "invalid path").into_response();
  }
  match fs::read_to_string(rel).await {
    Ok(s) => s.into_response(),
    Err(e) => (StatusCode::NOT_FOUND, e.to_string()).into_response(),
  }
}

async fn run(Json(req): Json<RunReq>) -> impl IntoResponse {
  // minimal allowlist — keep this tight
  const ALLOWED: &[&str] = &["git","gh","python3","bash"];
  let spec = req.spec;
  if !ALLOWED.contains(&spec.cmd.as_str()) {
    return (StatusCode::BAD_REQUEST, "command not allowed").into_response();
  }
  if spec.dry_run {
    return Json(RunRes {
      dry_run: true,
      status: 0,
      stdout: format!("DRY-RUN: {} {:?}", spec.cmd, spec.args),
      stderr: String::new()
    }).into_response();
  }

  // timeout + output caps
  let output = timeout(
    Duration::from_secs(60),
    Command::new(&spec.cmd).args(&spec.args).output()
  ).await;

  match output {
    Err(_) => (StatusCode::REQUEST_TIMEOUT, "timeout").into_response(),
    Ok(Err(e)) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    Ok(Ok(out)) => {
      let status = out.status.code().unwrap_or(-1);
      let mut stdout = String::from_utf8_lossy(&out.stdout).to_string();
      let mut stderr = String::from_utf8_lossy(&out.stderr).to_string();
      if stdout.len() > 200_000 { stdout.truncate(200_000); }
      if stderr.len() > 200_000 { stderr.truncate(200_000); }
      Json(RunRes { dry_run: false, status, stdout, stderr }).into_response()
    }
  }
}
