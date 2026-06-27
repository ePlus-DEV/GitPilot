use crate::{
    models::git::{GitCommandOutput, GitError, StashInfo},
    services::git_service,
};
#[tauri::command]
pub fn list_stashes(repo_path: String) -> Result<Vec<StashInfo>, GitError> {
    let out = git_service::git_text(&repo_path, &["stash", "list"])?;
    Ok(out
        .lines()
        .enumerate()
        .map(|(i, l)| {
            let parts: Vec<_> = l.splitn(3, ':').collect();
            StashInfo {
                index: i,
                name: parts.get(0).unwrap_or(&"").to_string(),
                branch: parts.get(1).unwrap_or(&"").trim().into(),
                message: parts.get(2).unwrap_or(&"").trim().into(),
            }
        })
        .collect())
}
#[tauri::command]
pub fn create_stash(repo_path: String, message: String) -> Result<GitCommandOutput, GitError> {
    if message.trim().is_empty() {
        git_service::git_checked(&repo_path, &["stash", "push"])
    } else {
        git_service::git_checked(&repo_path, &["stash", "push", "-m", message.trim()])
    }
}
#[tauri::command]
pub fn apply_stash(repo_path: String, stash: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["stash", "apply", &stash])
}
#[tauri::command]
pub fn pop_stash(repo_path: String, stash: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["stash", "pop", &stash])
}
#[tauri::command]
pub fn drop_stash(repo_path: String, stash: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["stash", "drop", &stash])
}

#[tauri::command]
pub fn rename_stash(
    repo_path: String,
    stash: String,
    message: String,
) -> Result<GitCommandOutput, GitError> {
    let patch = git_service::git_text(&repo_path, &["stash", "show", "-p", &stash])?;
    let branch = format!("gitpilot-stash-rename-{}", std::process::id());
    git_service::git_checked(&repo_path, &["stash", "branch", &branch, &stash])?;
    let out = git_service::git_checked(&repo_path, &["stash", "push", "-m", message.trim()])?;
    let _ = git_service::git_checked(&repo_path, &["checkout", "-"]);
    let _ = git_service::git_checked(&repo_path, &["branch", "-D", &branch]);
    let _ = patch;
    Ok(out)
}
