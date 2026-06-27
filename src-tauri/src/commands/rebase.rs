use crate::{
    models::git::{GitCommandOutput, GitError},
    services::git_service,
};
#[tauri::command]
pub fn start_rebase(repo_path: String, onto: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["rebase", &onto])
}
#[tauri::command]
pub fn continue_rebase(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["rebase", "--continue"])
}
#[tauri::command]
pub fn abort_rebase(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["rebase", "--abort"])
}
#[tauri::command]
pub fn skip_rebase(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["rebase", "--skip"])
}

use crate::models::git::{RebaseState, RebaseTodoItem};
use std::{fs, path::Path};

#[tauri::command]
pub fn get_rebase_state(repo_path: String) -> Result<RebaseState, GitError> {
    let git = Path::new(&repo_path).join(".git");
    let merge = git.join("rebase-merge");
    let apply = git.join("rebase-apply");
    let dir = if merge.exists() { merge } else { apply };
    if !dir.exists() {
        return Ok(RebaseState {
            in_progress: false,
            interactive: false,
            current_branch: None,
            onto: None,
            todo: vec![],
        });
    }
    let todo_path = dir.join("git-rebase-todo");
    let done_path = dir.join("done");
    let todo_src = fs::read_to_string(&todo_path)
        .or_else(|_| fs::read_to_string(&done_path))
        .unwrap_or_default();
    let todo = todo_src
        .lines()
        .filter_map(|l| {
            let line = l.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let mut p = line.splitn(3, ' ');
            Some(RebaseTodoItem {
                action: p.next()?.into(),
                hash: p.next().unwrap_or_default().into(),
                message: p.next().unwrap_or_default().into(),
            })
        })
        .collect();
    Ok(RebaseState {
        in_progress: true,
        interactive: todo_path.exists(),
        current_branch: fs::read_to_string(dir.join("head-name"))
            .ok()
            .map(|s| s.trim().trim_start_matches("refs/heads/").into()),
        onto: fs::read_to_string(dir.join("onto"))
            .ok()
            .map(|s| s.trim().into()),
        todo,
    })
}

#[tauri::command]
pub fn start_interactive_rebase(
    repo_path: String,
    base: String,
    todo: Vec<RebaseTodoItem>,
) -> Result<GitCommandOutput, GitError> {
    let script = todo
        .into_iter()
        .map(|i| format!("{} {} {}", i.action, i.hash, i.message))
        .collect::<Vec<_>>()
        .join("\n");
    let dir = std::env::temp_dir();
    let todo_path = dir.join("gitpilot-rebase-todo.txt");
    fs::write(&todo_path, script)
        .map_err(|e| GitError::new("TODO_WRITE_FAILED", e.to_string(), ""))?;
    let editor_path = if cfg!(windows) {
        let path = dir.join("gitpilot-sequence-editor.cmd");
        fs::write(
            &path,
            format!("@echo off\r\ntype \"{}\" > %1\r\n", todo_path.display()),
        )
        .map_err(|e| GitError::new("EDITOR_WRITE_FAILED", e.to_string(), ""))?;
        path
    } else {
        let path = dir.join("gitpilot-sequence-editor.sh");
        fs::write(
            &path,
            format!("#!/bin/sh\ncat '{}' > \"$1\"\n", todo_path.display()),
        )
        .map_err(|e| GitError::new("EDITOR_WRITE_FAILED", e.to_string(), ""))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&path)
                .map_err(|e| GitError::new("EDITOR_STAT_FAILED", e.to_string(), ""))?
                .permissions();
            perms.set_mode(0o700);
            fs::set_permissions(&path, perms)
                .map_err(|e| GitError::new("EDITOR_CHMOD_FAILED", e.to_string(), ""))?;
        }
        path
    };
    let editor = editor_path.to_string_lossy().to_string();
    git_service::git_checked_env(
        &repo_path,
        &["rebase", "-i", &base],
        &[(&"GIT_SEQUENCE_EDITOR", &editor)],
    )
}
