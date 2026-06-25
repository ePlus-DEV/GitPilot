use crate::services::git_service::{run_git, CommandResult, GitResult};
#[tauri::command]
pub fn continue_rebase(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["rebase", "--continue"])
}
