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
