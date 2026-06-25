use crate::{
    models::git::{CommitFile, CommitInfo, GitError},
    services::git_service,
};
#[tauri::command]
pub fn get_history(repo_path: String, limit: u32) -> Result<Vec<CommitInfo>, GitError> {
    let fmt = "%H%x1f%h%x1f%P%x1f%an%x1f%ad%x1f%d%x1f%s";
    let out = git_service::git_text(
        &repo_path,
        &[
            "log",
            "--graph",
            "--date=short",
            &format!("--max-count={limit}"),
            &format!("--pretty=format:{fmt}"),
        ],
    )?;
    Ok(out
        .lines()
        .filter_map(|l| {
            let graph: String = l.chars().take_while(|c| *c != '\x1f').collect();
            let rest = &l[graph.len()..];
            let p: Vec<_> = rest.trim_start().split('\x1f').collect();
            if p.len() < 7 {
                return None;
            }
            Some(CommitInfo {
                hash: p[0].into(),
                short_hash: p[1].into(),
                parents: p[2].split_whitespace().map(|s| s.into()).collect(),
                author: p[3].into(),
                date: p[4].into(),
                refs: p[5]
                    .trim_matches(|c| c == '(' || c == ')' || c == ' ')
                    .split(',')
                    .filter(|s| !s.trim().is_empty())
                    .map(|s| s.trim().into())
                    .collect(),
                message: p[6].into(),
                head: p[5].contains("HEAD"),
                graph,
            })
        })
        .collect())
}
#[tauri::command]
pub fn get_commit_files(repo_path: String, commit: String) -> Result<Vec<CommitFile>, GitError> {
    let out = git_service::git_text(
        &repo_path,
        &[
            "diff-tree",
            "--no-commit-id",
            "--name-status",
            "-r",
            &commit,
        ],
    )?;
    Ok(out
        .lines()
        .filter_map(|l| {
            let mut p = l.split_whitespace();
            Some(CommitFile {
                status: p.next()?.into(),
                path: p.next()?.into(),
            })
        })
        .collect())
}
#[tauri::command]
pub fn compare_commits(repo_path: String, from: String, to: String) -> Result<String, GitError> {
    git_service::git_text(&repo_path, &["diff", "--stat", &from, &to])
}
