#[cfg(feature = "host")]
mod host {
    use serde::Serialize;
    use std::{
        path::{Path, PathBuf},
        process::{Command, Stdio},
        time::Duration,
    };

    const ROOTS: &[&str] = &["ade/flows", "kit/flows"];

    fn is_under_root(p: &Path) -> bool {
        let cwd = match std::env::current_dir() {
            Ok(d) => d,
            Err(_) => return false,
        };
        let abs = match cwd.join(p).canonicalize() {
            Ok(x) => x,
            Err(_) => return false,
        };
        ROOTS.iter().any(|r| {
            if let Ok(root) = cwd.join(r).canonicalize() {
                abs.starts_with(&root)
            } else {
                false
            }
        })
    }

    #[tauri::command]
    fn read_text_rel(rel: String) -> Result<String, String> {
        let p = std::path::Path::new(&rel);
        if !is_under_root(p) {
            return Err("invalid path".into());
        }
        std::fs::read_to_string(p).map_err(|e| e.to_string())
    }

    #[derive(serde::Deserialize)]
    struct RunSpec {
        cmd: String,
        args: Vec<String>,
        dry_run: bool,
    }

    #[derive(Serialize)]
    struct RunResult {
        dry_run: bool,
        status: i32,
        stdout: String,
        stderr: String,
    }

    #[tauri::command]
    fn run(spec: RunSpec) -> Result<RunResult, String> {
        let allowed = ["git", "gh", "python3", "bash"];
        if !allowed.contains(&spec.cmd.as_str()) {
            return Err("command not allowed".into());
        }
        if spec.dry_run {
            return Ok(RunResult {
                dry_run: true,
                status: 0,
                stdout: format!("DRY-RUN: {} {:?}", spec.cmd, spec.args),
                stderr: String::new(),
            });
        }
        let mut child = Command::new(&spec.cmd)
            .args(&spec.args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;

        // Stream stdout/stderr concurrently to avoid pipe deadlocks; cap output size.
        let cap: usize = 200_000;
        let mut out_buf = Vec::<u8>::new();
        let mut err_buf = Vec::<u8>::new();
        let mut so = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
        let mut se = child.stderr.take().ok_or_else(|| "no stderr".to_string())?;
        let t_out = std::thread::spawn(move || {
            use std::io::Read;
            let mut buf = Vec::with_capacity(8192);
            let mut tmp = [0u8; 8192];
            while let Ok(n) = so.read(&mut tmp) {
                if n == 0 {
                    break;
                }
                let take = tmp[..n].to_vec();
                if buf.len() + take.len() <= cap {
                    buf.extend_from_slice(&take);
                } else {
                    let remain = cap.saturating_sub(buf.len());
                    buf.extend_from_slice(&take[..remain.min(take.len())]);
                    break;
                }
            }
            buf
        });
        let t_err = std::thread::spawn(move || {
            use std::io::Read;
            let mut buf = Vec::with_capacity(4096);
            let mut tmp = [0u8; 4096];
            while let Ok(n) = se.read(&mut tmp) {
                if n == 0 {
                    break;
                }
                let take = tmp[..n].to_vec();
                if buf.len() + take.len() <= cap {
                    buf.extend_from_slice(&take);
                } else {
                    let remain = cap.saturating_sub(buf.len());
                    buf.extend_from_slice(&take[..remain.min(take.len())]);
                    break;
                }
            }
            buf
        });
        let timeout = Duration::from_secs(60);
        let start = std::time::Instant::now();
        let status_code = loop {
            if start.elapsed() > timeout {
                let _ = child.kill();
                let _ = child.wait();
                break -1;
            }
            if let Ok(Some(status)) = child.try_wait() {
                break status.code().unwrap_or(-1);
            }
            std::thread::sleep(Duration::from_millis(25));
        };
        if let Ok(b) = t_out.join() {
            out_buf = b;
        }
        if let Ok(b) = t_err.join() {
            err_buf = b;
        }
        let stdout = String::from_utf8_lossy(&out_buf).to_string();
        let stderr = String::from_utf8_lossy(&err_buf).to_string();
        if status_code == -1 && stderr.is_empty() {
            return Err("timeout".into());
        }
        Ok(RunResult {
            dry_run: false,
            status: status_code,
            stdout,
            stderr,
        })
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
