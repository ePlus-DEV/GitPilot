use crate::{
    commands::repository::open_repository,
    models::git_status::{GitFileStatus, GitStatus},
    services::git_service::{git_stdout, run_git, CommandResult, GitResult},
};
fn group(index: &str, wt: &str) -> String {
    if index == "U" || wt == "U" {
        "conflicted"
    } else if index != " " && index != "?" {
        "staged"
    } else if index == "?" || wt == "?" {
        "untracked"
    } else {
        "unstaged"
    }
    .into()
}
#[tauri::command]
pub fn get_status(path: String) -> GitResult<GitStatus> {
    let out = git_stdout(&path, &["status", "--porcelain=v1", "--branch"])?;
    let files = out
        .lines()
        .filter(|l| !l.starts_with("##"))
        .map(|l| {
            let index = l.get(0..1).unwrap_or(" ").to_string();
            let worktree = l.get(1..2).unwrap_or(" ").to_string();
            let path_part = l.get(3..).unwrap_or("").to_string();
            GitFileStatus {
                group: group(&index, &worktree),
                path: path_part,
                original_path: None,
                index,
                worktree,
            }
        })
        .collect();
    Ok(GitStatus {
        repository: open_repository(path.clone())?,
        files,
        ahead: 0,
        behind: 0,
        merging: std::path::Path::new(&path).join(".git/MERGE_HEAD").exists(),
        rebasing: std::path::Path::new(&path)
            .join(".git/rebase-merge")
            .exists(),
    })
}
#[tauri::command]
pub fn stage_file(repo_path: String, file_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["add", "--", &file_path])
}
#[tauri::command]
pub fn unstage_file(repo_path: String, file_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["restore", "--staged", "--", &file_path])
}
#[tauri::command]
pub fn stage_all(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["add", "-A"])
}
#[tauri::command]
pub fn unstage_all(repo_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["reset", "HEAD", "--"])
}
#[tauri::command]
pub fn discard_file(repo_path: String, file_path: String) -> GitResult<CommandResult> {
    run_git(&repo_path, &["restore", "--", &file_path])
}
