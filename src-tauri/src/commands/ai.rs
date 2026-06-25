use crate::services::git_service::GitResult;
#[tauri::command]
pub fn explain_diff(_repo_path: String, diff: String) -> GitResult<String> {
    Ok(format!("AI provider abstraction placeholder. Diff has {} bytes; suggestions are never auto-applied.",diff.len()))
}
