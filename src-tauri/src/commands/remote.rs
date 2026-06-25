use crate::services::git_service::{run_git, CommandResult, GitResult};
#[tauri::command]
pub fn fetch(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["fetch", "--all", "--prune"])
}
#[tauri::command]
pub fn pull(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["pull", "--ff-only"])
}
#[tauri::command]
pub fn push(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["push"])
}
