use axum::{
  extract::{Query, State},
  http::StatusCode,
  response::IntoResponse,
  routing::{get, post},
  Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{path::{Path, PathBuf}, time::Duration};
use tokio::{fs, process::Command, time::timeout};
use tower_http::cors::CorsLayer;

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

fn under_root(p: &Path, roots: &[PathBuf]) -> bool {
  let Ok(cwd) = std::env::current_dir() else { return false; };
  let Ok(abs) = cwd.join(p).canonicalize() else { return false; };
  for r in roots {
    if let Ok(root) = cwd.join(r).canonicalize() {
      if abs.starts_with(&root) { return true; }
    }
  }
  false
}

#[tokio::main]
async fn main() {
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
    .route("/read_text_rel", get(read_text_rel))
    .route("/run", post(run))
    .with_state(state)
    .layer(CorsLayer::very_permissive()); // dev-only

  let addr = std::net::SocketAddr::from(([127,0,0,1], 7345));
  println!("host-lite listening on http://{addr}");
  axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app).await.unwrap();
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
