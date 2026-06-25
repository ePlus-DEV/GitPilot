use serde::Serialize;
use std::{path::Path, process::Command};
#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}
#[derive(Debug, Serialize)]
pub struct GitError {
    pub message: String,
    pub command: Option<String>,
    pub stderr: Option<String>,
}
pub type GitResult<T> = Result<T, GitError>;
pub fn ensure_repo(path: &str) -> GitResult<()> {
    if !Path::new(path).join(".git").exists() {
        return Err(GitError {
            message: "Selected path is not a Git repository".into(),
            command: None,
            stderr: None,
        });
    }
    Ok(())
}
pub fn run_git(repo_path: &str, args: &[&str]) -> GitResult<CommandResult> {
    ensure_repo(repo_path)?;
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| GitError {
            message: e.to_string(),
            command: Some(format!("git {}", args.join(" "))),
            stderr: None,
        })?;
    let result = CommandResult {
        command: format!("git {}", args.join(" ")),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    };
    if output.status.success() {
        Ok(result)
    } else {
        Err(GitError {
            message: "Git command failed".into(),
            command: Some(result.command),
            stderr: Some(result.stderr),
        })
    }
}
pub fn git_stdout(repo_path: &str, args: &[&str]) -> GitResult<String> {
    Ok(run_git(repo_path, args)?.stdout)
}
