use crate::services::git_service::{run_git, CommandResult, GitResult};
#[tauri::command]
pub fn commit_changes(
    repo_path: String,
    message: String,
    allow_empty: bool,
) -> GitResult<CommandResult> {
    let mut args = vec!["commit", "-m", message.as_str()];
    if allow_empty {
        args.insert(1, "--allow-empty");
    }
    run_git(&repo_path, &args)
}
