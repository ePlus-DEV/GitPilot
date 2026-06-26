import { useGitStore } from '../../store/gitStore';
import type { CommitInfo } from '../../types/git';

const LANE_COLORS = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fb923c', // orange
  '#f472b6', // pink
  '#facc15', // yellow
  '#60a5fa', // blue
  '#4ade80', // green
  '#e879f9', // fuchsia
  '#f87171', // red
];

const ROW_H = 28;
const LANE_W = 16;
const CIRCLE_R = 4;
const PAD_LEFT = 8;

type RowData = {
  commit: CommitInfo;
  lane: number;
  color: string;
  // connections to draw in this row: {fromLane, toLane, color, isMerge}
  lines: Array<{ fromLane: number; toLane: number; color: string; pos: 'top' | 'bottom' | 'full' }>;
  maxLane: number;
};

function buildRows(commits: CommitInfo[]): RowData[] {
  // lanes[i] = { hash, colorIdx } — which commit hash "owns" lane i going forward
  const lanes: Array<{ hash: string; colorIdx: number } | null> = [];
  const colorCounter = { n: 0 };

  function nextColor(): number {
    return colorCounter.n++ % LANE_COLORS.length;
  }

  function findLane(hash: string): number {
    return lanes.findIndex(l => l?.hash === hash);
  }

  function freeLane(): number {
    const idx = lanes.findIndex(l => l === null);
    return idx === -1 ? lanes.length : idx;
  }

  const rows: RowData[] = [];

  for (const commit of commits) {
    // Find my lane
    let myLane = findLane(commit.hash);
    let myColorIdx: number;

    if (myLane === -1) {
      myLane = freeLane();
      myColorIdx = nextColor();
      if (myLane === lanes.length) lanes.push(null);
      lanes[myLane] = { hash: commit.hash, colorIdx: myColorIdx };
    } else {
      myColorIdx = lanes[myLane]!.colorIdx;
    }

    const myColor = LANE_COLORS[myColorIdx];
    const lines: RowData['lines'] = [];

    // All lanes that were active BEFORE this commit — draw vertical continuation lines
    // (they pass through the TOP half of this row)
    for (let i = 0; i < lanes.length; i++) {
      if (i === myLane) continue;
      if (lanes[i] !== null) {
        lines.push({ fromLane: i, toLane: i, color: LANE_COLORS[lanes[i]!.colorIdx], pos: 'top' });
      }
    }

    // My lane: draw line from top to my circle (if I was already tracked)
    // (already drawn implicitly by the circle row)

    // Now update lanes for this commit's children (parents in git terminology):
    // First parent continues in my lane
    const parents = commit.parents ?? [];

    // Release my lane first
    lanes[myLane] = null;

    // Assign first parent to my lane
    if (parents[0]) {
      const existingLane = findLane(parents[0]);
      if (existingLane === -1) {
        lanes[myLane] = { hash: parents[0], colorIdx: myColorIdx };
      } else {
        // First parent already tracked in another lane — merge: draw diagonal bottom half
        lines.push({ fromLane: myLane, toLane: existingLane, color: myColor, pos: 'bottom' });
        // myLane stays null (freed)
      }
    }

    // Additional parents (merge commits)
    for (let i = 1; i < parents.length; i++) {
      const p = parents[i];
      const existingLane = findLane(p);
      if (existingLane === -1) {
        const newLane = freeLane();
        const newColorIdx = nextColor();
        if (newLane === lanes.length) lanes.push(null);
        lanes[newLane] = { hash: p, colorIdx: newColorIdx };
        // Draw line from my lane to newLane (bottom half)
        lines.push({ fromLane: myLane, toLane: newLane, color: LANE_COLORS[newColorIdx], pos: 'bottom' });
      } else {
        // Already tracked, draw connection bottom half
        lines.push({ fromLane: myLane, toLane: existingLane, color: LANE_COLORS[lanes[existingLane]!.colorIdx], pos: 'bottom' });
      }
    }

    // All lanes active AFTER this commit — draw vertical continuation (bottom half)
    for (let i = 0; i < lanes.length; i++) {
      if (i === myLane) continue;
      if (lanes[i] !== null) {
        lines.push({ fromLane: i, toLane: i, color: LANE_COLORS[lanes[i]!.colorIdx], pos: 'bottom' });
      }
    }

    const maxLane = Math.max(myLane, ...lanes.map((l, i) => l !== null ? i : 0));

    rows.push({ commit, lane: myLane, color: myColor, lines, maxLane });
  }

  return rows;
}

function GraphRow({ row, idx, selected, onClick }: {
  row: RowData;
  idx: number;
  selected: boolean;
  onClick: () => void;
}) {
  const svgWidth = (row.maxLane + 1) * LANE_W + PAD_LEFT * 2;
  const cy = ROW_H / 2;
  const cx = PAD_LEFT + row.lane * LANE_W;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-0 border-t border-pilot-line text-left hover:bg-slate-800/60 transition-colors ${selected ? 'bg-slate-800' : ''}`}
      style={{ height: ROW_H }}
    >
      {/* SVG graph column */}
      <svg width={svgWidth} height={ROW_H} className="shrink-0 overflow-visible">
        {/* Render lines */}
        {row.lines.map((ln, i) => {
          const x1 = PAD_LEFT + ln.fromLane * LANE_W;
          const x2 = PAD_LEFT + ln.toLane * LANE_W;
          const y1 = ln.pos === 'bottom' ? cy : 0;
          const y2 = ln.pos === 'top' ? cy : ROW_H;

          if (x1 === x2) {
            // Straight vertical
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ln.color} strokeWidth={1.5} />;
          }
          // Bezier curve for diagonal
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
              fill="none"
              stroke={ln.color}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Commit circle */}
        <circle cx={cx} cy={cy} r={CIRCLE_R + 1} fill={row.color} opacity={0.2} />
        <circle cx={cx} cy={cy} r={CIRCLE_R} fill={row.color} />
        {row.commit.head && (
          <circle cx={cx} cy={cy} r={CIRCLE_R + 2.5} fill="none" stroke={row.color} strokeWidth={1.5} />
        )}
      </svg>

      {/* Commit info */}
      <div className="min-w-0 flex-1 flex items-center gap-2 pr-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Refs (branches/tags) */}
            {row.commit.refs.slice(0, 3).map(ref => (
              <span
                key={ref}
                className="shrink-0 rounded px-1 py-0 text-[9px] font-semibold"
                style={{
                  background: ref.includes('HEAD') ? '#38bdf822' : ref.includes('tag:') ? '#facc1522' : '#a78bfa22',
                  color: ref.includes('HEAD') ? '#38bdf8' : ref.includes('tag:') ? '#facc15' : '#a78bfa',
                  border: `1px solid ${ref.includes('HEAD') ? '#38bdf844' : ref.includes('tag:') ? '#facc1544' : '#a78bfa44'}`,
                }}
              >
                {ref.replace('HEAD -> ', '').replace('tag: ', '')}
              </span>
            ))}
            <span className="truncate text-xs text-slate-200">{row.commit.message}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {row.commit.shortHash} · {row.commit.author} · {row.commit.date}
          </div>
        </div>
      </div>
    </button>
  );
}

export function GitGraph() {
  const { history, selectedCommit, selectCommit } = useGitStore(s => ({
    history: s.history,
    selectedCommit: s.selectedCommit,
    selectCommit: s.selectCommit,
  }));

  const rows = buildRows(history);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Open a repository to see commit history
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#090e1b]">
      <div className="sticky top-0 z-10 bg-[#0d1324] border-b border-pilot-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        Commit History · {history.length} commits
      </div>
      {rows.map((row, idx) => (
        <GraphRow
          key={row.commit.hash}
          row={row}
          idx={idx}
          selected={selectedCommit?.hash === row.commit.hash}
          onClick={() => void selectCommit(row.commit)}
        />
      ))}
    </div>
  );
}
