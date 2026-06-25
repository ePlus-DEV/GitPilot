use crate::models::git::{GitCommandOutput, GitError};
use std::process::Command;

pub fn git(repo: &str, args: &[&str]) -> Result<GitCommandOutput, GitError> {
    let out = Command::new("git")
        .args(args)
        .current_dir(repo)
        .output()
        .map_err(|e| GitError::new("GIT_SPAWN_FAILED", format!("Failed to run git: {e}"), ""))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    Ok(GitCommandOutput {
        stdout,
        stderr,
        success: out.status.success(),
        command: format!("git {}", args.join(" ")),
    })
}
pub fn git_checked(repo: &str, args: &[&str]) -> Result<GitCommandOutput, GitError> {
    let r = git(repo, args)?;
    if r.success {
        Ok(r)
    } else {
        Err(GitError::new(
            "GIT_COMMAND_FAILED",
            if r.stderr.trim().is_empty() {
                r.stdout.clone()
            } else {
                r.stderr.clone()
            },
            r.stderr.clone(),
        ))
    }
}
pub fn git_text(repo: &str, args: &[&str]) -> Result<String, GitError> {
    Ok(git_checked(repo, args)?.stdout)
}
