use crate::{
    models::git::{GitError, GitFileStatus, GitStatus, MergeState},
    services::git_service,
};
use std::path::Path;
fn conflicted(x: &str, y: &str) -> bool {
    matches!(
        (x, y),
        ("D", "D") | ("A", "U") | ("U", "D") | ("U", "A") | ("D", "U") | ("A", "A") | ("U", "U")
    )
}
fn parse(line: &str) -> Option<GitFileStatus> {
    if line.len() < 4 {
        return None;
    }
    let x = &line[0..1];
    let y = &line[1..2];
    let raw = line[3..].trim();
    let (orig, path) = raw
        .split_once(" -> ")
        .map(|(a, b)| (Some(a.to_string()), b.to_string()))
        .unwrap_or((None, raw.to_string()));
    Some(GitFileStatus {
        path,
        original_path: orig,
        index_status: x.into(),
        worktree_status: y.into(),
        display_status: format!("{}{}", x, y).trim().to_string(),
        binary: false,
    })
}
#[tauri::command]
pub fn get_status(repo_path: String) -> Result<GitStatus, GitError> {
    let out = git_service::git_checked(&repo_path, &["status", "--porcelain=v1", "-b"])?;
    let mut s = GitStatus::default();
    for l in out.stdout.lines() {
        if let Some(rest) = l.strip_prefix("## ") {
            s.current_branch = rest.split('.').next().unwrap_or(rest).trim().to_string();
            s.ahead = rest
                .split("ahead ")
                .nth(1)
                .and_then(|v| v.split(|c| c == ',' || c == ']').next())
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            s.behind = rest
                .split("behind ")
                .nth(1)
                .and_then(|v| v.split(|c| c == ',' || c == ']').next())
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            continue;
        }
        let Some(f) = parse(l) else { continue };
        if f.index_status == "?" && f.worktree_status == "?" {
            s.untracked.push(f)
        } else if conflicted(&f.index_status, &f.worktree_status) {
            s.conflicted.push(f)
        } else {
            if f.index_status != " " {
                s.staged.push(f.clone())
            }
            if f.worktree_status != " " {
                s.unstaged.push(f)
            }
        }
    }
    let git = Path::new(&repo_path).join(".git");
    s.merge_state = MergeState {
        is_merging: git.join("MERGE_HEAD").exists(),
        is_rebasing: git.join("rebase-merge").exists() || git.join("rebase-apply").exists(),
        conflicted_files: s.conflicted.iter().map(|f| f.path.clone()).collect(),
    };
    Ok(s)
}
