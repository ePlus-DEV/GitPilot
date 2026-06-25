use crate::{
    models::git::{GitCommandOutput, GitError},
    services::git_service,
};
use std::{path::Path, process::Command};
fn run(repo: &str, bin: &str, args: &[&str]) -> GitCommandOutput {
    match Command::new(bin).args(args).current_dir(repo).output() {
        Ok(o) => GitCommandOutput {
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            success: o.status.success(),
            command: format!("{} {}", bin, args.join(" ")),
        },
        Err(e) => GitCommandOutput {
            stdout: String::new(),
            stderr: e.to_string(),
            success: false,
            command: format!("{} {}", bin, args.join(" ")),
        },
    }
}
#[tauri::command]
pub fn run_validation(repo_path: String) -> Result<Vec<GitCommandOutput>, GitError> {
    let changed = git_service::git_text(&repo_path, &["diff", "--name-only", "HEAD"])?;
    let mut out = Vec::new();
    for f in changed.lines().filter(|f| f.ends_with(".php")) {
        out.push(run(&repo_path, "php", &["-l", f]));
    }
    if Path::new(&repo_path).join("package.json").exists() {
        out.push(run(&repo_path, "npm", &["run", "lint"]));
    }
    if Path::new(&repo_path).join("artisan").exists() {
        out.push(run(&repo_path, "php", &["artisan", "test"]));
    }
    Ok(out)
}
