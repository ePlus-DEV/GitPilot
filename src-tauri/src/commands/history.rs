use crate::{
    models::git::{CommitFile, CommitInfo, GitError},
    services::git_service,
};

fn extract_stat(line: &str, keyword: &str) -> u32 {
    if let Some(pos) = line.find(keyword) {
        let before = line[..pos].trim_end();
        let num_str: String = before.chars().rev().take_while(|c| c.is_ascii_digit()).collect();
        if num_str.is_empty() { return 0; }
        num_str.chars().rev().collect::<String>().parse().unwrap_or(0)
    } else {
        0
    }
}

fn parse_stat_output(out: &str) -> std::collections::HashMap<String, (u32, u32)> {
    let mut map = std::collections::HashMap::new();
    let mut current_hash = String::new();
    for line in out.lines() {
        let t = line.trim();
        if t.is_empty() { continue; }
        if t.len() == 40 && t.chars().all(|c| c.is_ascii_hexdigit()) {
            current_hash = t.to_string();
        } else if !current_hash.is_empty() && (t.contains("file changed") || t.contains("files changed")) {
            let ins = extract_stat(t, "insertion");
            let del = extract_stat(t, "deletion");
            map.insert(current_hash.clone(), (ins, del));
            current_hash.clear();
        }
    }
    map
}

fn parse_history_output(out: &str) -> Vec<CommitInfo> {
    out.lines()
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
                insertions: 0,
                deletions: 0,
            })
        })
        .collect()
}

fn parse_commit_files_output(out: &str) -> Vec<CommitFile> {
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
    files
}

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

    // Clone formatted args for reuse in the stat command before consuming them
    let stat_filter_args: Vec<String> = [
        author_arg.as_deref(),
        since_arg.as_deref(),
        until_arg.as_deref(),
        grep_arg.as_deref(),
    ]
    .iter()
    .filter_map(|v| v.map(|s| s.to_string()))
    .collect();
    let stat_branch_arg = branch_arg.clone();

    let mut args = vec![
        "log".to_string(),
        "--topo-order".to_string(),
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
    let mut commits = parse_history_output(&out);

    // Fetch insertion/deletion stats via a separate shortstat pass
    let mut stat_args = vec!["log".to_string(), "--format=%H".to_string(), "--shortstat".to_string()];
    for f in stat_filter_args {
        stat_args.push(f);
    }
    if let Some(b) = stat_branch_arg {
        stat_args.push(b);
    } else {
        stat_args.push("--all".to_string());
    }
    let stat_refs: Vec<&str> = stat_args.iter().map(String::as_str).collect();
    if let Ok(stat_out) = git_service::git_text(&repo_path, &stat_refs) {
        let stats = parse_stat_output(&stat_out);
        for commit in commits.iter_mut() {
            if let Some(&(ins, del)) = stats.get(&commit.hash) {
                commit.insertions = ins;
                commit.deletions = del;
            }
        }
    }

    Ok(commits)
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
    Ok(parse_commit_files_output(&out))
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
pub fn create_annotated_tag_from_commit(
    repo_path: String,
    name: String,
    message: String,
    commit: String,
) -> Result<crate::models::git::GitCommandOutput, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    git_service::git_checked(&repo_path, &["tag", "-a", &name, commit, "-m", &message])
}
#[tauri::command]
pub fn create_patch_from_commit(repo_path: String, commit: String) -> Result<String, GitError> {
    let commit = commit.trim();
    if commit.is_empty() {
        return Err(GitError::new("invalid_commit", "Commit hash is empty.", ""));
    }
    git_service::git_text(&repo_path, &["format-patch", "-1", "--stdout", commit])
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_graph_log_without_losing_hash_or_refs() {
        let out = concat!(
            "* 241f06babc1234567890\x1f241f06b\x1f5c7aef5\x1fDavid Nguyen\x1f2026-06-24\x1f (HEAD -> dev, origin/dev)\x1frefactor: optimize attributes\n",
            "| * 4c605d2abc1234567890\x1f4c605d2\x1f\x1fDavid Nguyen\x1f2026-06-24\x1f (origin/main)\x1ffeat: workflow dispatch\n",
            "bad graph continuation line\n",
        );

        let commits = parse_history_output(out);

        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].hash, "241f06babc1234567890");
        assert_eq!(commits[0].short_hash, "241f06b");
        assert_eq!(commits[0].parents, vec!["5c7aef5"]);
        assert_eq!(commits[0].refs, vec!["HEAD -> dev", "origin/dev"]);
        assert!(commits[0].head);
        assert_eq!(commits[0].graph.trim(), "*");
        assert_eq!(commits[1].hash, "4c605d2abc1234567890");
        assert_eq!(commits[1].graph.trim(), "| *");
    }

    #[test]
    fn parses_plain_log_line_without_graph_prefix() {
        let out = "abcdef123456\x1fabcdef1\x1f\x1fBot\x1f2026-06-24\x1f\x1fstyle: format\n";

        let commits = parse_history_output(out);

        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].hash, "abcdef123456");
        assert_eq!(commits[0].graph, "");
        assert!(!commits[0].head);
    }

    #[test]
    fn parses_commit_files_and_deduplicates_merge_entries() {
        let out = concat!(
            "M\0src/App.tsx\0",
            "R100\0src/old.ts\0src/new.ts\0",
            "C075\0src/base.ts\0src/copy.ts\0",
            "M\0src/App.tsx\0",
        );

        let files = parse_commit_files_output(out);

        assert_eq!(files.len(), 3);
        assert_eq!(files[0].status, "M");
        assert_eq!(files[0].path, "src/App.tsx");
        assert_eq!(files[1].status, "R");
        assert_eq!(files[1].path, "src/new.ts");
        assert_eq!(files[2].status, "C");
        assert_eq!(files[2].path, "src/copy.ts");
    }

    #[test]
    fn ignores_incomplete_commit_file_pairs() {
        let files = parse_commit_files_output("M\0");
        assert!(files.is_empty());
    }
}
