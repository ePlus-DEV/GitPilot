use std::path::Path;
use std::process::Command;

use crate::models::git::{GitCommandOutput, GitFileStatus, GitStatus};

fn run_git(repo_path: &str, args: &[&str]) -> Result<GitCommandOutput, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|error| format!("Failed to run git: {error}"))?;

    Ok(GitCommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
    })
}

fn run_git_checked(repo_path: &str, args: &[&str]) -> Result<GitCommandOutput, String> {
    let result = run_git(repo_path, args)?;
    if result.success {
        Ok(result)
    } else {
        Err(if result.stderr.trim().is_empty() {
            result.stdout.clone()
        } else {
            result.stderr.clone()
        })
    }
}

fn is_conflicted(index_status: &str, worktree_status: &str) -> bool {
    matches!(
        (index_status, worktree_status),
        ("D", "D") | ("A", "U") | ("U", "D") | ("U", "A") | ("D", "U") | ("A", "A") | ("U", "U")
    )
}

fn parse_status_line(line: &str) -> Option<GitFileStatus> {
    if line.len() < 4 {
        return None;
    }

    let index = &line[0..1];
    let worktree = &line[1..2];
    let raw_path = line[3..].trim().to_string();
    let path = raw_path
        .rsplit_once(" -> ")
        .map(|(_, new_path)| new_path.to_string())
        .unwrap_or(raw_path);

    Some(GitFileStatus {
        path,
        index_status: index.to_string(),
        worktree_status: worktree.to_string(),
    })
}

#[tauri::command]
pub fn validate_repository(path: String) -> Result<bool, String> {
    if !Path::new(&path).is_dir() {
        return Ok(false);
    }

    let output = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(path)
        .output()
        .map_err(|error| format!("Failed to run git: {error}"))?;

    Ok(output.status.success() && String::from_utf8_lossy(&output.stdout).trim() == "true")
}

#[tauri::command]
pub fn get_status(repo_path: String) -> Result<GitStatus, String> {
    let output = run_git_checked(&repo_path, &["status", "--porcelain"])?;
    let mut status = GitStatus::default();

    for line in output.stdout.lines() {
        let Some(file) = parse_status_line(line) else {
            continue;
        };

        if file.index_status == "?" && file.worktree_status == "?" {
            status.untracked.push(file);
        } else if is_conflicted(&file.index_status, &file.worktree_status) {
            status.conflicted.push(file);
        } else {
            if file.index_status != " " {
                status.staged.push(GitFileStatus {
                    path: file.path.clone(),
                    index_status: file.index_status.clone(),
                    worktree_status: file.worktree_status.clone(),
                });
            }
            if file.worktree_status != " " {
                status.unstaged.push(file);
            }
        }
    }

    Ok(status)
}

#[tauri::command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<GitCommandOutput, String> {
    run_git_checked(&repo_path, &["add", "--", &file_path])
}

#[tauri::command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<GitCommandOutput, String> {
    run_git_checked(&repo_path, &["restore", "--staged", "--", &file_path])
}

#[tauri::command]
pub fn stage_all(repo_path: String) -> Result<GitCommandOutput, String> {
    run_git_checked(&repo_path, &["add", "--all"])
}

#[tauri::command]
pub fn unstage_all(repo_path: String) -> Result<GitCommandOutput, String> {
    run_git_checked(&repo_path, &["restore", "--staged", ":/"])
}

#[tauri::command]
pub fn get_diff(repo_path: String, file_path: String, cached: bool) -> Result<String, String> {
    let args = if cached {
        vec!["diff", "--cached", "--", file_path.as_str()]
    } else {
        vec!["diff", "--", file_path.as_str()]
    };
    let output = run_git_checked(&repo_path, &args)?;
    Ok(output.stdout)
}

#[tauri::command]
pub fn commit(repo_path: String, message: String) -> Result<GitCommandOutput, String> {
    if message.trim().is_empty() {
        return Err("Commit message is required.".to_string());
    }

    let staged = run_git_checked(&repo_path, &["diff", "--cached", "--name-only"])?;
    if staged.stdout.trim().is_empty() {
        return Err("No staged files to commit.".to_string());
    }

    run_git_checked(&repo_path, &["commit", "-m", message.trim()])
}
