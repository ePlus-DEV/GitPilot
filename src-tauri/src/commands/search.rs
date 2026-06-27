use crate::{
    models::git::{GitError, SearchResult},
    services::git_service,
};

fn matches(q: &str, text: &str) -> bool {
    let q = q.to_lowercase();
    let text = text.to_lowercase();
    let mut it = text.chars();
    q.chars().all(|c| it.any(|x| x == c))
}
#[tauri::command]
pub fn smart_search(
    repo_path: String,
    query: String,
    limit: u32,
) -> Result<Vec<SearchResult>, GitError> {
    let mut r = Vec::new();
    let lim = limit.to_string();
    let commits = git_service::git_text(
        &repo_path,
        &[
            "log",
            "--all",
            "--date=short",
            &format!("--max-count={}", lim),
            "--pretty=format:%h%x1f%an%x1f%ad%x1f%s",
        ],
    )?;
    for l in commits.lines() {
        let p: Vec<_> = l.split('\x1f').collect();
        if p.len() == 4 {
            let hay = format!("{} {} {}", p[0], p[1], p[3]);
            if matches(&query, &hay) {
                r.push(SearchResult {
                    kind: "commit".into(),
                    title: p[3].into(),
                    subtitle: format!("{} · {} · {}", p[0], p[1], p[2]),
                    target: p[0].into(),
                })
            }
        }
    }
    let branches = git_service::git_text(
        &repo_path,
        &["branch", "--all", "--format=%(refname:short)"],
    )?;
    for b in branches.lines() {
        if matches(&query, b) {
            r.push(SearchResult {
                kind: "branch".into(),
                title: b.into(),
                subtitle: "branch".into(),
                target: b.into(),
            })
        }
    }
    let files = git_service::git_text(&repo_path, &["ls-files"])?;
    for f in files.lines().take(limit as usize * 4) {
        if matches(&query, f) {
            r.push(SearchResult {
                kind: "file".into(),
                title: f.into(),
                subtitle: "tracked file".into(),
                target: f.into(),
            })
        }
    }
    r.truncate(limit as usize);
    Ok(r)
}
