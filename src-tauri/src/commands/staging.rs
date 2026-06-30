use crate::{
    models::git::{GitCommandOutput, GitError},
    services::git_service,
};
use std::{fs, path::Path};
#[tauri::command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["add", "--", &file_path])
}
#[tauri::command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["restore", "--staged", "--", &file_path])
}
#[tauri::command]
pub fn stage_all(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["add", "--all"])
}
#[tauri::command]
pub fn unstage_all(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["restore", "--staged", ":/"])
}
#[tauri::command]
pub fn discard_file(repo_path: String, file_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["restore", "--", &file_path])
}
#[tauri::command]
pub fn revert_hunk(repo_path: String, patch: String, cached: bool) -> Result<GitCommandOutput, GitError> {
    let tmp_path = std::env::temp_dir().join(format!("gitpilot_hunk_{}.patch", std::process::id()));
    fs::write(&tmp_path, patch.as_bytes())
        .map_err(|e| GitError::new("WRITE_FAILED", &e.to_string(), ""))?;
    let tmp_str = tmp_path.to_str().unwrap_or("/tmp/gitpilot.patch").to_string();
    let result = if cached {
        git_service::git_checked(&repo_path, &["apply", "--reverse", "--cached", &tmp_str])
    } else {
        git_service::git_checked(&repo_path, &["apply", "--reverse", &tmp_str])
    };
    let _ = fs::remove_file(&tmp_path);
    result
}

#[tauri::command]
pub fn delete_untracked_file(
    repo_path: String,
    file_path: String,
) -> Result<GitCommandOutput, GitError> {
    let p = Path::new(&repo_path).join(&file_path);
    fs::remove_file(&p).map_err(|e| {
        GitError::new(
            "DELETE_FAILED",
            format!("Failed to delete {file_path}: {e}"),
            "",
        )
    })?;
    Ok(GitCommandOutput {
        stdout: format!("Deleted {file_path}"),
        stderr: String::new(),
        success: true,
        command: format!("delete {file_path}"),
    })
}
