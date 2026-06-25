use crate::{
    models::{git::GitError, repository::RepositoryInfo},
    services::{config_service, git_service},
};
use std::path::Path;
#[tauri::command]
pub fn validate_repository(path: String) -> Result<bool, GitError> {
    Ok(Path::new(&path).join(".git").exists()
        && git_service::git_checked(&path, &["rev-parse", "--is-inside-work-tree"]).is_ok())
}
#[tauri::command]
pub fn open_repository(path: String) -> Result<RepositoryInfo, GitError> {
    if !validate_repository(path.clone())? {
        return Err(GitError::new(
            "INVALID_REPOSITORY",
            "Selected folder is not a Git repository",
            "",
        ));
    }
    let branch = git_service::git_text(&path, &["branch", "--show-current"])
        .unwrap_or_default()
        .trim()
        .to_string();
    let name = Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or(path.clone());
    Ok(RepositoryInfo {
        name,
        path,
        current_branch: branch,
    })
}
#[tauri::command]
pub fn list_recent_repositories() -> Result<Vec<String>, String> {
    Ok(config_service::load()?.recent_repositories)
}
#[tauri::command]
pub fn save_recent_repository(path: String) -> Result<Vec<String>, String> {
    let mut s = config_service::load()?;
    s.recent_repositories.retain(|p| p != &path);
    s.recent_repositories.insert(0, path);
    s.recent_repositories.truncate(12);
    Ok(config_service::save(&s)?.recent_repositories)
}
#[tauri::command]
pub fn remove_recent_repository(path: String) -> Result<Vec<String>, String> {
    let mut s = config_service::load()?;
    s.recent_repositories.retain(|p| p != &path);
    Ok(config_service::save(&s)?.recent_repositories)
}
