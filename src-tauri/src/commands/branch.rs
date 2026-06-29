use crate::{
    models::git::{BranchInfo, GitCommandOutput, GitError},
    services::git_service,
};
fn parse_track(track: &str) -> (i32, i32) {
    let ahead: i32 = track.split("ahead ").nth(1)
        .and_then(|s| s.split([',', ']']).next())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0);
    let behind: i32 = track.split("behind ").nth(1)
        .and_then(|s| s.split(']').next())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0);
    (ahead, behind)
}

#[tauri::command]
pub fn list_branches(repo_path: String) -> Result<Vec<BranchInfo>, GitError> {
    let out = git_service::git_text(
        &repo_path,
        &[
            "branch",
            "--all",
            "--format=%(HEAD)|%(refname:short)|%(upstream:short)|%(upstream:track)|%(refname)",
        ],
    )?;
    Ok(out
        .lines()
        .filter_map(|l| {
            let p: Vec<_> = l.splitn(5, '|').collect();
            if p.len() < 2 {
                return None;
            }
            let name = p[1].trim().to_string();
            let full_ref = p.get(4).map(|s| s.trim()).unwrap_or("");
            let track = p.get(3).map(|s| s.trim()).unwrap_or("");
            let (ahead, behind) = parse_track(track);
            Some(BranchInfo {
                name: name.clone(),
                current: p[0].trim() == "*",
                remote: full_ref.starts_with("refs/remotes/"),
                upstream: p.get(2).filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string()),
                ahead,
                behind,
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
