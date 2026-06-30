use crate::{
    models::git::{GitCommandOutput, GitError, RemoteInfo},
    services::git_service,
};
#[tauri::command]
pub fn list_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, GitError> {
    let out = git_service::git_text(&repo_path, &["remote", "-v"])?;
    let mut map = std::collections::BTreeMap::<String, (String, String)>::new();
    for l in out.lines() {
        let parts: Vec<_> = l.split_whitespace().collect();
        if parts.len() >= 3 {
            let e = map.entry(parts[0].into()).or_default();
            if parts[2] == "(fetch)" {
                e.0 = parts[1].into()
            } else {
                e.1 = parts[1].into()
            }
        }
    }
    Ok(map
        .into_iter()
        .map(|(name, (fetch_url, push_url))| RemoteInfo {
            name,
            fetch_url,
            push_url,
        })
        .collect())
}
#[tauri::command]
pub fn fetch(repo_path: String, remote: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["fetch", &remote])
}
#[tauri::command]
pub fn fetch_all(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["fetch", "--all", "--prune", "--tags"])
}
#[tauri::command]
pub fn pull(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["pull"])
}
#[tauri::command]
pub fn push(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["push"])
}
#[tauri::command]
pub fn push_new_branch(
    repo_path: String,
    remote: String,
    branch: String,
) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["push", "-u", &remote, &branch])
}
