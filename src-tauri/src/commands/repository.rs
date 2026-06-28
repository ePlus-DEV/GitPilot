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
pub fn init_repository(
    path: String,
    initial_branch: Option<String>,
) -> Result<RepositoryInfo, GitError> {
    if !Path::new(&path).is_dir() {
        return Err(GitError::new(
            "INVALID_PATH",
            "Repository path must be an existing directory",
            "",
        ));
    }
    let mut args = vec!["init"];
    if let Some(branch) = initial_branch.as_deref().filter(|b| !b.trim().is_empty()) {
        args.push("--initial-branch");
        args.push(branch.trim());
    }
    git_service::git_checked(&path, &args)?;
    open_repository(path)
}
#[tauri::command]
pub fn clone_repository(
    url: String,
    destination: String,
    branch: Option<String>,
    depth: Option<u32>,
) -> Result<RepositoryInfo, GitError> {
    if url.trim().is_empty() {
        return Err(GitError::new("INVALID_REMOTE", "Clone URL is required", ""));
    }
    if destination.trim().is_empty() {
        return Err(GitError::new(
            "INVALID_PATH",
            "Destination path is required",
            "",
        ));
    }
    let destination_path = Path::new(&destination);
    if destination_path.exists()
        && destination_path
            .read_dir()
            .map(|mut e| e.next().is_some())
            .unwrap_or(true)
    {
        return Err(GitError::new(
            "DESTINATION_NOT_EMPTY",
            "Clone destination must be empty or not exist",
            "",
        ));
    }
    let parent = destination_path.parent().unwrap_or_else(|| Path::new("."));
    let leaf = destination_path
        .file_name()
        .map(|v| v.to_string_lossy().to_string())
        .ok_or_else(|| {
            GitError::new("INVALID_PATH", "Destination must include a folder name", "")
        })?;
    let mut owned = vec!["clone".to_string()];
    if let Some(branch) = branch.filter(|b| !b.trim().is_empty()) {
        owned.push("--branch".into());
        owned.push(branch.trim().into());
    }
    if let Some(depth) = depth.filter(|d| *d > 0) {
        owned.push("--depth".into());
        owned.push(depth.to_string());
    }
    owned.push(url.trim().into());
    owned.push(leaf);
    let refs: Vec<&str> = owned.iter().map(String::as_str).collect();
    git_service::git_checked(parent.to_string_lossy().as_ref(), &refs)?;
    open_repository(destination)
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
