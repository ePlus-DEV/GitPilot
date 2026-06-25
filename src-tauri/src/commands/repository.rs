use crate::{
    models::repository::RepositoryInfo,
    services::git_service::{ensure_repo, git_stdout, GitResult},
};
use std::path::Path;
#[tauri::command]
pub fn open_repository(path: String) -> GitResult<RepositoryInfo> {
    ensure_repo(&path)?;
    let branch = git_stdout(&path, &["branch", "--show-current"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let name = Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    Ok(RepositoryInfo {
        name,
        path,
        current_branch: branch,
        is_git_repository: true,
    })
}
