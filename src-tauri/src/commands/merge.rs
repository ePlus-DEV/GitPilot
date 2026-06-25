use crate::services::git_service::{run_git, CommandResult, GitResult};
#[tauri::command]
pub fn merge_branch(repo_path: String, branch: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["merge", &branch])
}
#[tauri::command]
pub fn abort_merge(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["merge", "--abort"])
}
