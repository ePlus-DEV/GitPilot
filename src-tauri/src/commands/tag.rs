use crate::services::git_service::{git_stdout, GitResult};
#[tauri::command]
pub fn list_tags(repo_path: String) -> GitResult<String> {
    git_stdout(&repo_path, &["tag", "--list"])
}
