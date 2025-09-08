#[cfg(feature = "host")]
mod host {
    use serde::Serialize;
    use std::{path::{Path, PathBuf}, process::{Command, Stdio}, time::Duration, io::Read};

    const ROOTS: &[&str] = &["ade/flows", "kit/flows"];

    fn is_under_root(p: &Path) -> bool {
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let abs = cwd.join(p).canonicalize().unwrap_or_else(|_| cwd.clone());
        ROOTS.iter().any(|r| {
            let root = cwd.join(r).canonicalize().unwrap_or_else(|_| cwd.clone());
            abs.starts_with(&root)
        })
    }

    #[tauri::command]
    fn read_text_rel(rel: String) -> Result<String, String> {
        let p = std::path::Path::new(&rel);
        if !is_under_root(p) { return Err("invalid path".into()); }
        std::fs::read_to_string(p).map_err(|e| e.to_string())
    }

    #[derive(serde::Deserialize)]
    struct RunSpec { cmd: String, args: Vec<String>, dry_run: bool }

    #[derive(Serialize)]
    struct RunResult { dry_run: bool, status: i32, stdout: String, stderr: String }

    #[tauri::command]
    fn run(spec: RunSpec) -> Result<RunResult, String> {
        let allowed = ["git","gh","python3","bash"];
        if !allowed.contains(&spec.cmd.as_str()) { return Err("command not allowed".into()); }
        if spec.dry_run {
            return Ok(RunResult{ dry_run: true, status: 0, stdout: format!("DRY-RUN: {} {:?}", spec.cmd, spec.args), stderr: String::new() });
        }
        let mut child = Command::new(&spec.cmd)
            .args(&spec.args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;

        // naive timeout/output cap
        let timeout = Duration::from_secs(60);
        let start = std::time::Instant::now();
        let mut out = String::new();
        let mut err = String::new();
        loop {
            if start.elapsed() > timeout { let _ = child.kill(); break; }
            let e = child.try_wait();
            if let Ok(Some(status)) = e {
                if let Some(mut so) = child.stdout.take() { let _ = so.read_to_string(&mut out); }
                if let Some(mut se) = child.stderr.take() { let _ = se.read_to_string(&mut err); }
                return Ok(RunResult{ dry_run:false, status: status.code().unwrap_or(-1), stdout: out.chars().take(200_000).collect(), stderr: err.chars().take(200_000).collect() });
            }
            std::thread::sleep(Duration::from_millis(30));
        }
        Err("timeout".into())
    }

    pub fn run_app() {
        tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![read_text_rel, run])
            .run(tauri::generate_context!())
            .expect("error running app");
    }
}

fn main() {
    #[cfg(feature = "host")]
    return host::run_app();
    println!("ADE Workbench host stub");
}
