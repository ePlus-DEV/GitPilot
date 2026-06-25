use crate::models::conflict::{ConflictBlock, ParsedConflictFile};

pub fn parse(path: String, content: String) -> ParsedConflictFile {
    let lines: Vec<&str> = content.lines().collect();
    let mut blocks = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        if lines[i].starts_with("<<<<<<<") {
            let start = i;
            i += 1;
            let mut cur = Vec::new();
            while i < lines.len() && !lines[i].starts_with("=======") {
                cur.push(lines[i]);
                i += 1;
            }
            let sep = i;
            if i < lines.len() {
                i += 1;
            }
            let mut inc = Vec::new();
            while i < lines.len() && !lines[i].starts_with(">>>>>>>") {
                inc.push(lines[i]);
                i += 1;
            }
            let end = i;
            blocks.push(ConflictBlock {
                id: blocks.len(),
                start_line: start + 1,
                separator_line: sep + 1,
                end_line: end + 1,
                current: cur.join("\n"),
                incoming: inc.join("\n"),
            });
        }
        i += 1;
    }
    let has_markers = !blocks.is_empty();
    ParsedConflictFile {
        path,
        content,
        blocks,
        has_markers,
    }
}
pub fn contains_markers(content: &str) -> bool {
    content
        .lines()
        .any(|l| l.starts_with("<<<<<<<") || l.starts_with("=======") || l.starts_with(">>>>>>>"))
}
