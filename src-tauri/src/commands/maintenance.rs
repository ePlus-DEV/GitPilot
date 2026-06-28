use crate::{
    models::git::{BisectState, GitCommandOutput, GitError, ReflogEntry, SubmoduleInfo},
    services::git_service,
};
use std::path::Path;

#[tauri::command]
pub fn list_reflog(repo_path: String, limit: Option<u32>) -> Result<Vec<ReflogEntry>, GitError> {
    let count = limit.unwrap_or(100).clamp(1, 1000).to_string();
    let pretty = "%gd%x1f%H%x1f%gs";
    let max_count = format!("--max-count={count}");
    let format = format!("--format={pretty}");
    let out = git_service::git_text(&repo_path, &["reflog", &max_count, &format])?;
    Ok(out
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(3, '\u{1f}');
            Some(ReflogEntry {
                selector: parts.next()?.to_string(),
                commit: parts.next()?.to_string(),
                subject: parts.next().unwrap_or_default().to_string(),
            })
        })
        .collect())
}

#[tauri::command]
pub fn list_submodules(repo_path: String) -> Result<Vec<SubmoduleInfo>, GitError> {
    let out = git_service::git(&repo_path, &["submodule", "status", "--recursive"])?;
    if !out.success && out.stderr.contains("no submodule mapping") {
        return Ok(vec![]);
    }
    if !out.success {
        return Err(GitError::new(
            "GIT_COMMAND_FAILED",
            out.stderr.clone(),
            out.stderr,
        ));
    }
    Ok(out
        .stdout
        .lines()
        .filter_map(|line| {
            let status = line.chars().next().unwrap_or(' ').to_string();
            let rest = line.get(1..)?.trim();
            let mut parts = rest.split_whitespace();
            let commit = parts.next()?.to_string();
            let path = parts.next()?.to_string();
            let branch = parts
                .next()
                .map(|s| s.trim_matches(|c| c == '(' || c == ')').to_string());
            Some(SubmoduleInfo {
                path,
                commit,
                branch,
                status,
            })
        })
        .collect())
}

#[tauri::command]
pub fn update_submodules(
    repo_path: String,
    init: bool,
    recursive: bool,
) -> Result<GitCommandOutput, GitError> {
    let mut args = vec!["submodule", "update"];
    if init {
        args.push("--init");
    }
    if recursive {
        args.push("--recursive");
    }
    git_service::git_checked(&repo_path, &args)
}

#[tauri::command]
pub fn start_bisect(
    repo_path: String,
    bad: String,
    good: String,
) -> Result<GitCommandOutput, GitError> {
    if bad.trim().is_empty() || good.trim().is_empty() {
        return Err(GitError::new(
            "INVALID_BISECT_RANGE",
            "Both bad and good revisions are required",
            "",
        ));
    }
    git_service::git_checked(&repo_path, &["bisect", "start", bad.trim(), good.trim()])
}

#[tauri::command]
pub fn mark_bisect(repo_path: String, verdict: String) -> Result<GitCommandOutput, GitError> {
    match verdict.as_str() {
        "good" | "bad" | "skip" => {
            git_service::git_checked(&repo_path, &["bisect", verdict.as_str()])
        }
        _ => Err(GitError::new(
            "INVALID_BISECT_VERDICT",
            "Bisect verdict must be good, bad, or skip",
            "",
        )),
    }
}

#[tauri::command]
pub fn reset_bisect(repo_path: String) -> Result<GitCommandOutput, GitError> {
    git_service::git_checked(&repo_path, &["bisect", "reset"])
}

#[tauri::command]
pub fn get_bisect_state(repo_path: String) -> Result<BisectState, GitError> {
    let git_dir = git_service::git_text(&repo_path, &["rev-parse", "--git-dir"])?;
    let in_progress = Path::new(&repo_path)
        .join(git_dir.trim())
        .join("BISECT_LOG")
        .exists();
    let current = git_service::git_text(&repo_path, &["rev-parse", "--short", "HEAD"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let log = if in_progress {
        git_service::git_text(&repo_path, &["bisect", "log"])
            .unwrap_or_default()
            .lines()
            .map(str::to_string)
            .collect()
    } else {
        vec![]
    };
    Ok(BisectState {
        in_progress,
        current,
        log,
    })
}
