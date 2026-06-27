use crate::{
    models::git::{GitCommandOutput, GitError, WorktreeInfo},
    services::git_service,
};

#[tauri::command]
pub fn list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>, GitError> {
    let out = git_service::git_text(&repo_path, &["worktree", "list", "--porcelain"])?;
    let mut items = Vec::new();
    let mut cur: Option<WorktreeInfo> = None;
    for line in out.lines() {
        if let Some(path) = line.strip_prefix("worktree ") {
            if let Some(item) = cur.take() {
                items.push(item);
            }
            cur = Some(WorktreeInfo {
                path: path.into(),
                head: String::new(),
                branch: None,
                bare: false,
                detached: false,
            });
        } else if let Some(item) = cur.as_mut() {
            if let Some(head) = line.strip_prefix("HEAD ") {
                item.head = head.into();
            } else if let Some(branch) = line.strip_prefix("branch ") {
                item.branch = Some(branch.trim_start_matches("refs/heads/").into());
            } else if line == "bare" {
                item.bare = true;
            } else if line == "detached" {
                item.detached = true;
            }
        }
    }
    if let Some(item) = cur {
        items.push(item);
    }
    Ok(items)
}
#[tauri::command]
pub fn create_worktree(
    repo_path: String,
    path: String,
    branch: String,
    new_branch: bool,
) -> Result<GitCommandOutput, GitError> {
    if new_branch {
        git_service::git_checked(&repo_path, &["worktree", "add", "-b", &branch, &path])
    } else {
        git_service::git_checked(&repo_path, &["worktree", "add", &path, &branch])
    }
}
#[tauri::command]
pub fn remove_worktree(
    repo_path: String,
    path: String,
    force: bool,
) -> Result<GitCommandOutput, GitError> {
    if force {
        git_service::git_checked(&repo_path, &["worktree", "remove", "--force", &path])
    } else {
        git_service::git_checked(&repo_path, &["worktree", "remove", &path])
    }
}
