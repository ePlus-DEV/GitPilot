use crate::{
    models::git::{CommitFile, CommitInfo, GitError},
    services::git_service,
};
#[tauri::command]
pub fn get_history(
    repo_path: String,
    limit: u32,
    branch: Option<String>,
    author: Option<String>,
    since: Option<String>,
    until: Option<String>,
    keyword: Option<String>,
    file_path: Option<String>,
) -> Result<Vec<CommitInfo>, GitError> {
    let fmt = "%H%x1f%h%x1f%P%x1f%an%x1f%ad%x1f%d%x1f%s";
    let max_count = format!("--max-count={limit}");
    let pretty = format!("--pretty=format:{fmt}");
    let author_arg = author
        .filter(|v| !v.trim().is_empty() && v != "all")
        .map(|v| format!("--author={v}"));
    let since_arg = since
        .filter(|v| !v.trim().is_empty())
        .map(|v| format!("--since={v}"));
    let until_arg = until
        .filter(|v| !v.trim().is_empty())
        .map(|v| format!("--until={v}"));
    let grep_arg = keyword
        .filter(|v| !v.trim().is_empty())
        .map(|v| format!("--grep={v}"));
    let branch_arg = branch.filter(|v| !v.trim().is_empty() && v != "all");
    let file_arg = file_path.filter(|v| !v.trim().is_empty());

    let mut args = vec![
        "log".to_string(),
        "--graph".to_string(),
        "--decorate".to_string(),
        "--date=short".to_string(),
        max_count,
        pretty,
    ];
    if let Some(author) = author_arg {
        args.push(author);
    }
    if let Some(since) = since_arg {
        args.push(since);
    }
    if let Some(until) = until_arg {
        args.push(until);
    }
    if let Some(grep) = grep_arg {
        args.push(grep);
    }
    if let Some(branch) = branch_arg {
        args.push(branch);
    } else {
        args.push("--all".to_string());
    }
    if let Some(path) = file_arg {
        args.push("--".to_string());
        args.push(path);
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = git_service::git_text(&repo_path, &refs)?;
    Ok(out
        .lines()
        .filter_map(|l| {
            let p: Vec<_> = l.splitn(7, '\x1f').collect();
            if p.len() < 7 {
                return None;
            }
            let graph_and_hash = p[0].trim_end();
            let (graph, hash) = if let Some(idx) = graph_and_hash.rfind(char::is_whitespace) {
                (
                    graph_and_hash[..idx].to_string(),
                    graph_and_hash[idx..].trim().to_string(),
                )
            } else {
                (String::new(), graph_and_hash.trim().to_string())
            };
            if hash.is_empty() {
                return None;
            }
            Some(CommitInfo {
                hash,
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
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    let out = git_service::git_text(
        &repo_path,
        &[
            "diff-tree",
            "--root",
            "-m",
            "--name-status",
            "-z",
            "--no-commit-id",
            "-r",
            commit,
        ],
    )?;
    let mut files = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut parts = out.split('\0').filter(|p| !p.is_empty());
    while let Some(status) = parts.next() {
        let Some(path) = parts.next() else {
            break;
        };
        let path = if status.starts_with('R') || status.starts_with('C') {
            parts.next().unwrap_or(path)
        } else {
            path
        };
        let display_status = status
            .chars()
            .next()
            .map(|c| c.to_string())
            .unwrap_or_else(|| status.to_string());
        if seen.insert((display_status.clone(), path.to_string())) {
            files.push(CommitFile {
                status: display_status,
                path: path.into(),
            });
        }
    }
    Ok(files)
}
#[tauri::command]
pub fn compare_commits(repo_path: String, from: String, to: String) -> Result<String, GitError> {
    let from = from.trim();
    let to = to.trim();
    if from.is_empty() || to.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit range contains an empty revision.", ""));
    }
    git_service::git_text(&repo_path, &["diff", "--stat", from, to])
}

#[tauri::command]
pub fn checkout_commit(
    repo_path: String,
    commit: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    git_service::git_checked(&repo_path, &["checkout", commit])
}
#[tauri::command]
pub fn create_branch_from_commit(
    repo_path: String,
    name: String,
    commit: String,
    checkout: bool,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    if checkout {
        git_service::git_checked(&repo_path, &["checkout", "-b", &name, commit])
    } else {
        git_service::git_checked(&repo_path, &["branch", &name, commit])
    }
}
#[tauri::command]
pub fn create_tag_from_commit(
    repo_path: String,
    name: String,
    commit: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    git_service::git_checked(&repo_path, &["tag", &name, commit])
}
#[tauri::command]
pub fn cherry_pick_commit(
    repo_path: String,
    commit: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    git_service::git_checked(&repo_path, &["cherry-pick", commit])
}
#[tauri::command]
pub fn revert_commit(
    repo_path: String,
    commit: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    git_service::git_checked(&repo_path, &["revert", "--no-edit", commit])
}
#[tauri::command]
pub fn reset_to_commit(
    repo_path: String,
    commit: String,
    mode: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    let flag = match mode.as_str() {
        "soft" => "--soft",
        "hard" => "--hard",
        _ => "--mixed",
    };
    git_service::git_checked(&repo_path, &["reset", flag, commit])
}

#[tauri::command]
pub fn abort_cherry_pick(
    repo_path: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["cherry-pick", "--abort"])
}

#[tauri::command]
pub fn blame_file(
    repo_path: String,
    file_path: String,
) -> Result<Vec<crate::models::git::BlameLine>, GitError> {
    let out = git_service::git_text(&repo_path, &["blame", "--line-porcelain", "--", &file_path])?;
    let mut res = Vec::new();
    let mut commit = String::new();
    let mut author = String::new();
    let mut time = String::new();
    let mut line_no = 0usize;
    for l in out.lines() {
        if l.chars().take(40).all(|c| c.is_ascii_hexdigit()) {
            let p: Vec<_> = l.split_whitespace().collect();
            commit = p[0].into();
            line_no = p.get(2).and_then(|v| v.parse().ok()).unwrap_or(0);
        } else if let Some(v) = l.strip_prefix("author ") {
            author = v.into();
        } else if let Some(v) = l.strip_prefix("author-time ") {
            time = v.into();
        } else if let Some(v) = l.strip_prefix('\t') {
            res.push(crate::models::git::BlameLine {
                line_number: line_no,
                commit: commit.clone(),
                author: author.clone(),
                timestamp: time.clone(),
                text: v.into(),
            });
        }
    }
    Ok(res)
}
