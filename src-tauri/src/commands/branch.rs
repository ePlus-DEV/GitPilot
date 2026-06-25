use crate::{
    models::git::{BranchInfo, GitCommandOutput, GitError},
    services::git_service,
};
#[tauri::command]
pub fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, GitError> {
    let out = git_service::git_text(
        &repo_path,
        &[
            "branch",
            "--all",
            "--format=%(HEAD)|%(refname:short)|%(upstream:short)",
        ],
    )?;
    Ok(out
        .lines()
        .filter_map(|l| {
            let p: Vec<_> = l.split('|').collect();
            if p.len() < 2 {
                return None;
            }
            let name = p[1].trim().to_string();
            Some(BranchInfo {
                name: name.clone(),
                current: p[0].trim() == "*",
                remote: name.starts_with("remotes/"),
                upstream: p.get(2).filter(|s| !s.is_empty()).map(|s| s.to_string()),
                ahead: 0,
                behind: 0,
            })
        })
        .collect())
}
#[tauri::command]
pub fn create_branch(
    repo_path: String,
    name: String,
    checkout: bool,
) -> Result<GitCommandOutput, GitError> {
    if checkout {
        git_service::git_checked(&repo_path, &["checkout", "-b", &name])
    } else {
        git_service::git_checked(&repo_path, &["branch", &name])
    }
}
#[tauri::command]
pub fn checkout_branch(repo_path: String, name: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["checkout", &name])
}
#[tauri::command]
pub fn rename_branch(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["branch", "-m", &old_name, &new_name])
}
#[tauri::command]
pub fn delete_branch(
    repo_path: String,
    name: String,
    force: bool,
) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(
        &repo_path,
        &["branch", if force { "-D" } else { "-d" }, &name],
    )
}
#[tauri::command]
pub fn compare_branch(repo_path: String, branch: String) -> Result<String, GitError> {
    git_service::git_text(&repo_path, &["diff", "--stat", "HEAD", &branch])
}
