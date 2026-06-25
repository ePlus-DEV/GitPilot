use crate::models::conflict::ConflictBlock;
pub fn parse_conflicts(content: &str) -> Vec<ConflictBlock> {
    let lines: Vec<&str> = content.lines().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        if !lines[i].starts_with("<<<<<<<") {
            i += 1;
            continue;
        }
        let start = i + 1;
        i += 1;
        let mut current = Vec::new();
        while i < lines.len() && !lines[i].starts_with("=======") {
            current.push(lines[i]);
            i += 1;
        }
        i += 1;
        let mut incoming = Vec::new();
        while i < lines.len() && !lines[i].starts_with(">>>>>>>") {
            incoming.push(lines[i]);
            i += 1;
        }
        out.push(ConflictBlock {
            id: out.len(),
            start_line: start,
            end_line: i + 1,
            current: current.join("\n"),
            incoming: incoming.join("\n"),
            base: None,
        });
        i += 1;
    }
    out
}
