use crate::{
    models::git::{CommitGraphRow, GitError, GraphRef},
    services::git_service,
};
use std::collections::{HashMap, HashSet};

const NUM_COLORS: usize = 10;

struct RawCommit {
    sha: String,
    short_sha: String,
    parents: Vec<String>,
    author_name: String,
    author_email: String,
    timestamp: i64,
    refs: Vec<GraphRef>,
    message: String,
    is_head: bool,
}

/// All short names of remote tracking refs (e.g. "origin/main", "upstream/feature/xxx").
fn get_remote_ref_names(repo_path: &str) -> HashSet<String> {
    match git_service::git_text(
        repo_path,
        &["for-each-ref", "refs/remotes", "--format=%(refname:short)"],
    ) {
        Ok(out) => out
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect(),
        Err(_) => HashSet::new(),
    }
}

/// Map of local branch short name → upstream tracking ref short name.
fn get_tracking_map(repo_path: &str) -> HashMap<String, String> {
    match git_service::git_text(
        repo_path,
        &[
            "for-each-ref",
            "refs/heads",
            "--format=%(refname:short)|%(upstream:short)",
        ],
    ) {
        Ok(out) => out
            .lines()
            .filter_map(|line| {
                let mut parts = line.splitn(2, '|');
                let local = parts.next()?.trim().to_string();
                let upstream = parts.next()?.trim().to_string();
                if upstream.is_empty() {
                    return None;
                }
                Some((local, upstream))
            })
            .collect(),
        Err(_) => HashMap::new(),
    }
}

/// Parse "%D" ref decoration string into structured GraphRef list.
/// "%D" format: "HEAD -> main, origin/main, tag: v1.0"
fn parse_graph_refs(refs_str: &str) -> (Vec<GraphRef>, bool) {
    let mut refs = Vec::new();
    let mut is_head = false;

    for part in refs_str.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }

        if let Some(branch) = part.strip_prefix("HEAD -> ") {
            let branch = branch.trim();
            is_head = true;
            refs.push(GraphRef {
                name: branch.to_string(),
                ref_type: "local".to_string(),
                full_name: format!("refs/heads/{branch}"),
                upstream: None,
            });
            refs.push(GraphRef {
                name: "HEAD".to_string(),
                ref_type: "head".to_string(),
                full_name: "HEAD".to_string(),
                upstream: None,
            });
        } else if part == "HEAD" {
            is_head = true;
        } else if let Some(tag) = part.strip_prefix("tag: ") {
            let tag = tag.trim();
            refs.push(GraphRef {
                name: tag.to_string(),
                ref_type: "tag".to_string(),
                full_name: format!("refs/tags/{tag}"),
                upstream: None,
            });
        } else if part.contains('/') {
            // Tentatively classify as remote; will be corrected by post-processing
            // if it turns out to be a local branch with '/' in its name.
            refs.push(GraphRef {
                name: part.to_string(),
                ref_type: "remote".to_string(),
                full_name: format!("refs/remotes/{part}"),
                upstream: None,
            });
        } else {
            refs.push(GraphRef {
                name: part.to_string(),
                ref_type: "local".to_string(),
                full_name: format!("refs/heads/{part}"),
                upstream: None,
            });
        }
    }

    (refs, is_head)
}

fn parse_log_output(out: &str) -> Vec<RawCommit> {
    out.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(8, '\x1f').collect();
            if parts.len() < 8 {
                return None;
            }
            let sha = parts[0].trim().to_string();
            if sha.is_empty() {
                return None;
            }
            let (refs, is_head) = parse_graph_refs(parts[6]);
            Some(RawCommit {
                sha,
                short_sha: parts[1].trim().to_string(),
                parents: parts[2].split_whitespace().map(|s| s.to_string()).collect(),
                author_name: parts[3].to_string(),
                author_email: parts[4].to_string(),
                timestamp: parts[5].trim().parse().unwrap_or(0),
                refs,
                message: parts[7].trim().to_string(),
                is_head,
            })
        })
        .collect()
}

/// Compute lane positions for each commit from parent relationships.
///
/// State: active_lanes[i] = Some(sha) means lane i is tracking that sha as
/// an expected future commit. None = lane slot is free.
///
/// For each commit row:
///   top_lines  = active lanes BEFORE this commit is resolved (lines entering from above)
///   bottom_lines = active lanes AFTER parents are placed (lines continuing below)
///   edges      = [from_col, to_col, color_idx] bezier curves drawn in the bottom half
fn compute_lanes(commits: &[RawCommit]) -> Vec<CommitGraphRow> {
    let mut active_lanes: Vec<Option<String>> = Vec::new();
    let mut lane_colors: Vec<usize> = Vec::new();
    let mut color_counter: usize = 0;
    let mut result = Vec::new();

    for commit in commits {
        // Snapshot before processing: lanes active coming from the row above.
        let top_lines: Vec<[usize; 2]> = active_lanes
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                if s.is_some() {
                    Some([i, lane_colors[i]])
                } else {
                    None
                }
            })
            .collect();

        // Find or allocate this commit's lane.
        let commit_lane =
            if let Some(pos) = active_lanes.iter().position(|s| s.as_deref() == Some(&commit.sha))
            {
                pos
            } else {
                if let Some(pos) = active_lanes.iter().position(|s| s.is_none()) {
                    active_lanes[pos] = Some(commit.sha.clone());
                    lane_colors[pos] = color_counter % NUM_COLORS;
                    color_counter += 1;
                    pos
                } else {
                    active_lanes.push(Some(commit.sha.clone()));
                    lane_colors.push(color_counter % NUM_COLORS);
                    color_counter += 1;
                    active_lanes.len() - 1
                }
            };

        let commit_color = lane_colors[commit_lane];

        // Remove this commit from its lane.
        active_lanes[commit_lane] = None;

        let mut edges: Vec<[usize; 3]> = Vec::new();

        // Place parents into active_lanes.
        if let Some(primary) = commit.parents.first() {
            if let Some(parent_lane) = active_lanes
                .iter()
                .position(|s| s.as_deref() == Some(primary.as_str()))
            {
                // Primary parent already tracked in another lane (convergence).
                edges.push([commit_lane, parent_lane, lane_colors[parent_lane]]);
                // commit_lane remains None (will be trimmed or reused).
            } else {
                // Continuation: primary parent inherits commit's lane and color.
                active_lanes[commit_lane] = Some(primary.clone());
            }
        }

        for parent in commit.parents.iter().skip(1) {
            if let Some(parent_lane) = active_lanes
                .iter()
                .position(|s| s.as_deref() == Some(parent.as_str()))
            {
                edges.push([commit_lane, parent_lane, lane_colors[parent_lane]]);
            } else {
                // Fork: allocate a new lane for this additional parent.
                let new_lane = if let Some(pos) = active_lanes.iter().position(|s| s.is_none()) {
                    active_lanes[pos] = Some(parent.clone());
                    lane_colors[pos] = color_counter % NUM_COLORS;
                    color_counter += 1;
                    pos
                } else {
                    active_lanes.push(Some(parent.clone()));
                    lane_colors.push(color_counter % NUM_COLORS);
                    color_counter += 1;
                    active_lanes.len() - 1
                };
                edges.push([commit_lane, new_lane, lane_colors[new_lane]]);
            }
        }

        let bottom_lines: Vec<[usize; 2]> = active_lanes
            .iter()
            .enumerate()
            .filter_map(|(i, s)| {
                if s.is_some() {
                    Some([i, lane_colors[i]])
                } else {
                    None
                }
            })
            .collect();

        // Trim trailing free slots to keep the vec compact.
        while active_lanes.last() == Some(&None) {
            active_lanes.pop();
            lane_colors.pop();
        }

        let edge_max_col = edges.iter().map(|e| e[1]).max().unwrap_or(0);
        let num_cols = active_lanes
            .len()
            .max(commit_lane + 1)
            .max(edge_max_col + 1);

        result.push(CommitGraphRow {
            sha: commit.sha.clone(),
            short_sha: commit.short_sha.clone(),
            message: commit.message.clone(),
            author_name: commit.author_name.clone(),
            author_email: commit.author_email.clone(),
            timestamp: commit.timestamp,
            parents: commit.parents.clone(),
            refs: commit.refs.clone(),
            lane: commit_lane,
            color_index: commit_color,
            is_merge: commit.parents.len() > 1,
            is_head: commit.is_head,
            top_lines,
            bottom_lines,
            edges,
            num_cols,
        });
    }

    result
}

#[tauri::command]
pub fn get_commit_graph(
    repo_path: String,
    limit: Option<u32>,
    branch: Option<String>,
    include_all: Option<bool>,
    skip: Option<u32>,
) -> Result<Vec<CommitGraphRow>, GitError> {
    let max_count = limit.unwrap_or(500);
    let all = include_all.unwrap_or(true);

    let fmt = "%H\x1f%h\x1f%P\x1f%an\x1f%ae\x1f%at\x1f%D\x1f%s";
    let mut args = vec![
        "log".to_string(),
        "--topo-order".to_string(),
        format!("--max-count={max_count}"),
        format!("--pretty=format:{fmt}"),
    ];

    if let Some(n) = skip.filter(|&n| n > 0) {
        args.push(format!("--skip={n}"));
    }

    match branch.filter(|b| !b.trim().is_empty()) {
        Some(b) => args.push(b),
        None if all => args.push("--all".to_string()),
        None => {}
    }

    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = git_service::git_text(&repo_path, &refs)?;

    if out.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut raw = parse_log_output(&out);

    // Enrich refs: correct misclassified local branches (those containing '/' in their name)
    // and annotate local branches with their tracking upstream ref.
    let remote_names = get_remote_ref_names(&repo_path);
    let tracking = get_tracking_map(&repo_path);

    for commit in &mut raw {
        for r in &mut commit.refs {
            if r.ref_type == "remote" || r.ref_type == "local" {
                if remote_names.contains(&r.name) {
                    // Confirmed remote
                    r.ref_type = "remote".to_string();
                    r.full_name = format!("refs/remotes/{}", r.name);
                } else if r.ref_type == "remote" {
                    // Was guessed remote (contains '/') but not in actual remotes → local branch with '/' in name
                    r.ref_type = "local".to_string();
                    r.full_name = format!("refs/heads/{}", r.name);
                }
            }
            if r.ref_type == "local" {
                r.upstream = tracking.get(&r.name).cloned();
            }
        }
    }

    Ok(compute_lanes(&raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk(sha: &str, parents: &[&str]) -> RawCommit {
        RawCommit {
            sha: sha.to_string(),
            short_sha: sha[..1].to_string(),
            parents: parents.iter().map(|s| s.to_string()).collect(),
            author_name: "test".to_string(),
            author_email: "t@t.com".to_string(),
            timestamp: 0,
            refs: vec![],
            message: sha.to_string(),
            is_head: false,
        }
    }

    #[test]
    fn linear_chain() {
        let commits = vec![mk("A", &["B"]), mk("B", &["C"]), mk("C", &[])];
        let rows = compute_lanes(&commits);
        assert_eq!(rows.len(), 3);
        for r in &rows {
            assert_eq!(r.lane, 0);
            assert!(r.edges.is_empty());
        }
        assert!(rows[0].top_lines.is_empty());
        assert!(rows[2].bottom_lines.is_empty());
    }

    #[test]
    fn merge_commit_two_parents() {
        // A merges B into C's line; topo: A, B, C, D
        let commits = vec![
            mk("A", &["C", "B"]),
            mk("B", &["D"]),
            mk("C", &["D"]),
            mk("D", &[]),
        ];
        let rows = compute_lanes(&commits);
        assert!(rows[0].is_merge);
        assert_eq!(rows[0].lane, 0);
        assert_eq!(rows[0].edges.len(), 1); // fork to B's lane
        assert_eq!(rows[1].lane, 1);        // B on lane 1
        assert_eq!(rows[2].lane, 0);        // C on lane 0
        assert_eq!(rows[3].lane, 1);        // D on lane 1 (where B put it)
    }

    #[test]
    fn two_independent_tips_converge() {
        let commits = vec![mk("A", &["C"]), mk("B", &["C"]), mk("C", &[])];
        let rows = compute_lanes(&commits);
        assert_eq!(rows[0].lane, 0);
        assert_eq!(rows[1].lane, 1);
        assert_eq!(rows[2].lane, 0);
        // B's row has an edge converging to C's lane
        assert_eq!(rows[1].edges.len(), 1);
        assert_eq!(rows[1].edges[0][0], 1); // from B's lane
        assert_eq!(rows[1].edges[0][1], 0); // to C's lane
    }

    #[test]
    fn root_commit_no_lines() {
        let rows = compute_lanes(&[mk("A", &[])]);
        assert!(rows[0].top_lines.is_empty());
        assert!(rows[0].bottom_lines.is_empty());
        assert!(rows[0].edges.is_empty());
    }

    #[test]
    fn detached_head_single_commit() {
        let mut c = mk("A", &[]);
        c.is_head = true;
        let rows = compute_lanes(&[c]);
        assert!(rows[0].is_head);
    }

    #[test]
    fn empty_input() {
        let rows = compute_lanes(&[]);
        assert!(rows.is_empty());
    }
}
