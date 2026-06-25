use crate::{
    models::git::{GitCommandOutput, GitError, TagInfo},
    services::git_service,
};
#[tauri::command]
pub fn list_tags(repo_path: String) -> Result<Vec<TagInfo>, GitError> {
    let out = git_service::git_text(&repo_path, &["tag", "-n99"])?;
    Ok(out
        .lines()
        .map(|l| {
            let mut p = l.splitn(2, char::is_whitespace);
            let name = p.next().unwrap_or("").to_string();
            TagInfo {
                name,
                target: String::new(),
                message: p.next().unwrap_or("").trim().into(),
            }
        })
        .collect())
}
#[tauri::command]
pub fn create_lightweight_tag(
    repo_path: String,
    name: String,
) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["tag", &name])
}
#[tauri::command]
pub fn create_annotated_tag(
    repo_path: String,
    name: String,
    message: String,
) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["tag", "-a", &name, "-m", &message])
}
#[tauri::command]
pub fn delete_tag(repo_path: String, name: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["tag", "-d", &name])
}
#[tauri::command]
pub fn push_tag(
    repo_path: String,
    remote: String,
    name: String,
) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["push", &remote, &name])
}
