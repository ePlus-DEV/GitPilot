use crate::services::git_service::{run_git, CommandResult, GitResult};
#[tauri::command]
pub fn validate_file(repo_path: String, file_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["status", "--short", "--", &file_path])
}
