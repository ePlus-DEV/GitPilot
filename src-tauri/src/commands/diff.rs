use crate::services::git_service::{git_stdout, GitResult};
#[tauri::command]
pub fn get_diff(repo_path: String, file_path: String, staged: bool) -> GitResult<String> {
    if staged {
        git_stdout(&repo_path, &["diff", "--staged", "--", &file_path])
    } else {
        git_stdout(&repo_path, &["diff", "--", &file_path])
    }
}
