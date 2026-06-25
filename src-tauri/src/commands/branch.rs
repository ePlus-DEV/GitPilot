use crate::{
    models::branch::BranchInfo,
    services::git_service::{git_stdout, GitResult},
};
#[tauri::command]
pub fn list_branches(repo_path: String) -> GitResult<Vec<BranchInfo>> {
    let out = git_stdout(
        &repo_path,
        &[
            "branch",
            "--all",
            "--format=%(HEAD)|%(refname:short)|%(refname)|%(upstream:short)",
        ],
    )?;
    Ok(out
        .lines()
        .map(|l| {
            let p: Vec<&str> = l.split('|').collect();
            let full = p.get(2).unwrap_or(&"").to_string();
            BranchInfo {
                name: p.get(1).unwrap_or(&"").to_string(),
                full_name: full.clone(),
                current: p.first() == Some(&"*"),
                remote: full.starts_with("refs/remotes/"),
                upstream: p.get(3).filter(|s| !s.is_empty()).map(|s| s.to_string()),
            }
        })
        .collect())
}
