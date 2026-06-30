import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, Cloud, EyeOff, GitCommitHorizontal, Monitor, Pencil, RefreshCw, Search, Settings2, Tag, X } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { useLayoutStore } from '../../store/layoutStore';
import { gitService } from '../../services/gitService';
import type { CommitGraphRow, CommitInfo, HistoryFilters } from '../../types/git';
import { ColumnConfigMenu } from './ColumnConfigMenu';

const LANE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#4ade80', '#e879f9', '#f87171'];
const ROW_H = 34;
const LANE_W = 12;          // Tighter lanes — more branches visible, closer to GitKraken spacing
const CIRCLE_R = 4;
const STROKE_W = 1.8;       // Slightly thicker than before for crisper lines
const PAD_LEFT = 4;
const OVERSCAN = 8;
const MAX_LANES = 14;       // Support more parallel lanes before truncating
const MAX_GRAPH_CHARS = MAX_LANES * 2;
const GRAPH_W = MAX_LANES * LANE_W + PAD_LEFT * 2;
const GRAPH_COL_W = GRAPH_W + 4;
const BRANCH_COL_W = 148;
const AUTHOR_W = 110;
const DATE_W = 72;
const HASH_W = 64;
const CHANGES_W = 80;
const LOAD_MORE_H = 58;

type RowData = {
  commit: CommitInfo;
  graph: CommitGraphRow | null;
};

function relativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

const isMergeCommit = (c: CommitInfo) => c.parents.length > 1 || /^merge /i.test(c.message);

const normalized = (value: string) => value.toLowerCase().trim();

function matchesCommit(commit: CommitInfo, query: string) {
  const q = normalized(query);
  if (!q) return true;
  const refNames = commit.refs.join(' ');
  return [commit.message, commit.hash, commit.shortHash, commit.author, refNames].some(v => normalized(v).includes(q));
}

function cleanRef(ref: string) {
  return ref.replace('HEAD -> ', '').replace('tag: ', '');
}


const laneX = (col: number) => PAD_LEFT + Math.max(0, col) * LANE_W;

/** Bezier curve from (x1, yMid) to (x2, yEnd) — immediately diverges horizontally to avoid overlap with straight lane lines. */
function edgePath(x1: number, x2: number, yMid: number, yEnd: number): string {
  if (x1 === x2) return `M ${x1} ${yMid} L ${x1} ${yEnd}`;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${yMid} C ${mx} ${yMid} ${mx} ${yEnd} ${x2} ${yEnd}`;
}

/** Single shared SVG layer over the visible row range — eliminates per-row clipping that breaks lane lines. */
function GraphLayer({
  rows,
  startIndex,
  laneLabels,
  activeLane,
  left,
}: {
  rows: RowData[];
  startIndex: number;
  laneLabels: Map<number, string>;
  activeLane: number;
  left: number;
}) {
  const [nodeGhost, setNodeGhost] = useState<{ x: number; y: number; color: string; label: string } | null>(null);
  const [hoveredLane, setHoveredLane] = useState<number | null>(null);
  const svgH = rows.length * ROW_H;

  // Opacity helpers — activeLane < 0 means "no focus, show everything equally"
  const lineO = (col: number) => {
    if (activeLane < 0) return 1;
    if (col === activeLane) return 1;
    if (hoveredLane === col) return 0.72;
    return 0.18;
  };
  const edgeO = (from: number, to: number) => {
    if (activeLane < 0) return 1;
    if (from === activeLane || to === activeLane) return 0.78;
    if (hoveredLane === from || hoveredLane === to) return 0.65;
    return 0.16;
  };
  const nodeO = (lane: number) => {
    if (activeLane < 0) return 1;
    if (lane === activeLane) return 1;
    if (hoveredLane === lane) return 0.82;
    return 0.3;
  };

  return (
    <>
      <svg
        className="pointer-events-none absolute"
        style={{ left, top: startIndex * ROW_H, width: GRAPH_COL_W, height: svgH, zIndex: 2 }}
        shapeRendering="geometricPrecision"
      >
        {rows.map((row, i) => {
          const g = row.graph;
          const cy = i * ROW_H + ROW_H / 2;
          if (!g) {
            return (
              <g key={row.commit.hash || `r${i}`}>
                <circle cx={PAD_LEFT} cy={cy} r={CIRCLE_R} fill={LANE_COLORS[0]} />
                <circle cx={PAD_LEFT} cy={cy} r={CIRCLE_R - 1.5} fill="#0d1117" />
                <circle cx={PAD_LEFT} cy={cy} r={CIRCLE_R - 1.5} fill={LANE_COLORS[0]} opacity={0.5} />
              </g>
            );
          }

          const rowTop = i * ROW_H;
          const rowBottom = (i + 1) * ROW_H;
          const cx = laneX(g.lane);
          const nodeColor = LANE_COLORS[g.colorIndex % LANE_COLORS.length];
          const edgeTargetCols = new Set(g.edges.map(([, toCol]) => toCol));
          const hasBadge = g.refs.some(r => r.refType === 'local' || r.refType === 'remote');
          const ghostLabel = hasBadge ? undefined : laneLabels.get(g.lane);
          const nO = nodeO(g.lane);

          return (
            <g key={row.commit.hash || `r${i}`}>
              {/* Top-half lane continuations */}
              {g.topLines.map(([col, ci], j) => (
                <line key={`t${i}-${j}`}
                  x1={laneX(col)} y1={rowTop} x2={laneX(col)} y2={cy}
                  stroke={LANE_COLORS[ci % LANE_COLORS.length]}
                  strokeWidth={col === activeLane ? STROKE_W + 0.3 : STROKE_W}
                  strokeLinecap="round"
                  opacity={lineO(col)} />
              ))}
              {/* Bottom-half lane continuations (skip bezier target cols — bezier covers them) */}
              {g.bottomLines
                .filter(([col]) => !edgeTargetCols.has(col))
                .map(([col, ci], j) => (
                  <line key={`b${i}-${j}`}
                    x1={laneX(col)} y1={cy} x2={laneX(col)} y2={rowBottom}
                    stroke={LANE_COLORS[ci % LANE_COLORS.length]}
                    strokeWidth={col === activeLane ? STROKE_W + 0.3 : STROKE_W}
                    strokeLinecap="round"
                    opacity={lineO(col)} />
                ))}
              {/* Bezier merge/fork edges */}
              {g.edges.map(([fromCol, toCol, ci], j) => (
                <path key={`e${i}-${j}`}
                  d={edgePath(laneX(fromCol), laneX(toCol), cy, rowBottom)}
                  stroke={LANE_COLORS[ci % LANE_COLORS.length]}
                  strokeWidth={STROKE_W} fill="none" strokeLinecap="round"
                  opacity={edgeO(fromCol, toCol)} />
              ))}
              {/* Commit node — glow → outer → dark ring → inner */}
              <g opacity={nO}>
                <circle cx={cx} cy={cy} r={CIRCLE_R + 3.5} fill={nodeColor} opacity={0.13} />
                <circle cx={cx} cy={cy} r={CIRCLE_R} fill={nodeColor} />
                <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill="#0d1117" />
                <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill={nodeColor} opacity={0.5} />
                {g.isHead && (
                  <circle cx={cx} cy={cy} r={CIRCLE_R + 2.5}
                    fill="none" stroke={nodeColor} strokeWidth={1.5} opacity={0.9} />
                )}
                {g.isMerge && !g.isHead && (
                  <circle cx={cx} cy={cy} r={CIRCLE_R + 2}
                    fill="none" stroke={nodeColor} strokeWidth={1} opacity={0.55} />
                )}
              </g>
              {/* Hover hit-area — always present so inactive lanes can be hovered */}
              <circle cx={cx} cy={cy} r={CIRCLE_R + 5}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: 'default' }}
                onMouseEnter={(e) => {
                  setHoveredLane(g.lane);
                  if (ghostLabel) {
                    const rect = (e.currentTarget as Element).getBoundingClientRect();
                    setNodeGhost({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, color: nodeColor, label: ghostLabel });
                  }
                }}
                onMouseLeave={() => { setHoveredLane(null); setNodeGhost(null); }}
              />
            </g>
          );
        })}
      </svg>
      {nodeGhost && createPortal(
        <div
          className="pointer-events-none fixed z-[9990] whitespace-nowrap rounded px-1.5 text-[11px] font-semibold"
          style={{
            left: nodeGhost.x,
            top: nodeGhost.y,
            transform: 'translate(-110%, -50%)',
            marginLeft: -4,
            opacity: 0.62,
            background: '#1a2233',
            color: nodeGhost.color,
            border: `1px solid ${nodeGhost.color}55`,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '18px',
          }}
        >
          {nodeGhost.label}
        </div>,
        document.body,
      )}
    </>
  );
}

function ChangesBar({ ins, del, maxTotal }: { ins: number; del: number; maxTotal: number }) {
  const total = ins + del;
  if (total === 0 || maxTotal === 0) return null;
  const BAR_W = 36;
  const scale = Math.min(1, total / maxTotal);
  const insW = total > 0 ? Math.round((ins / total) * BAR_W * scale) : 0;
  const delW = Math.round(BAR_W * scale) - insW;
  return (
    <div className="flex items-center gap-1 px-2">
      <div className="flex overflow-hidden rounded-[2px]" style={{ width: BAR_W, height: 6 }}>
        {insW > 0 && <div className="bg-emerald-500" style={{ width: insW }} />}
        {delW > 0 && <div className="bg-red-500" style={{ width: delW }} />}
        {insW + delW < BAR_W && <div className="bg-[#21262d]" style={{ width: BAR_W - insW - delW }} />}
      </div>
      <div className="flex flex-col leading-none">
        {ins > 0 && <span className="text-[8px] font-mono text-emerald-500">+{ins}</span>}
        {del > 0 && <span className="text-[8px] font-mono text-red-500">-{del}</span>}
      </div>
    </div>
  );
}

type BadgeHover = {
  x: number; y: number; h: number;
  name: string;
  local?: boolean; remote?: boolean; isTag?: boolean;
  bg: string; fg: string; bdr: string;
};

function ExpandedBadge({ b }: { b: BadgeHover }) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[12px] font-semibold"
      style={{
        left: b.x, top: b.y, height: b.h,
        /* Solid dark bg so commit message doesn't bleed through */
        background: '#1a2233',
        color: b.fg,
        border: b.bdr,
        alignItems: 'center',
        boxShadow: '0 2px 16px rgba(0,0,0,0.7)',
      }}
    >
      {b.name}
      {b.local && <Monitor size={10} className="shrink-0 opacity-80" />}
      {b.remote && <Cloud size={10} className="shrink-0 opacity-80" />}
      {b.isTag && <Tag size={10} className="shrink-0 opacity-80" />}
    </div>,
    document.body,
  );
}

function BranchCell({ row, selected, onBranchContextMenu, smartBranch, currentBranch, branchColW }: {
  row: RowData;
  selected: boolean;
  onBranchContextMenu?: (e: ReactMouseEvent, name: string, local: boolean, remote: boolean) => void;
  smartBranch: boolean;
  currentBranch: string;
  branchColW: number;
}) {
  const laneColor = row.graph
    ? LANE_COLORS[row.graph.colorIndex % LANE_COLORS.length]
    : LANE_COLORS[0];
  const [hover, setHover] = useState<BadgeHover | null>(null);

  // Use typed refs from graph data — avoids '/' ambiguity (local feature/xxx vs remote origin/xxx)
  const graphRefs = row.graph?.refs ?? [];
  const hasAnyRef = graphRefs.some(r => r.refType !== 'head');
  if (!hasAnyRef || branchColW === 0) return <div className="shrink-0" style={{ width: branchColW }} />;

  const isHead = graphRefs.some(r => r.refType === 'head');

  // Group: each local ref is paired with its tracking remote (if that remote is on this same commit).
  // Remote-only refs (no local counterpart here) get their own badge.
  type BadgeGroup = { name: string; displayName: string; local: boolean; remote: boolean };
  const groups: BadgeGroup[] = [];
  const usedRemoteNames = new Set<string>();

  for (const ref of graphRefs) {
    if (ref.refType !== 'local') continue;
    // Find tracking remote on this same commit: use upstream annotation first, then heuristic
    const paired = graphRefs.find(r => {
      if (r.refType !== 'remote') return false;
      if (ref.upstream) return r.name === ref.upstream;
      // Heuristic: remote.name = "<remoteName>/<localName>"
      const slash = r.name.indexOf('/');
      return slash >= 0 && r.name.slice(slash + 1) === ref.name;
    });
    if (paired) usedRemoteNames.add(paired.name);
    groups.push({ name: ref.name, displayName: ref.name, local: true, remote: !!paired });
  }

  // Remote refs without a local counterpart on this commit
  for (const ref of graphRefs) {
    if (ref.refType !== 'remote') continue;
    if (usedRemoteNames.has(ref.name)) continue;
    if (ref.name.endsWith('/HEAD')) continue; // skip origin/HEAD noise
    // Strip remote prefix for display (e.g. "origin/feature/xxx" → "feature/xxx")
    const slash = ref.name.indexOf('/');
    const displayName = slash >= 0 ? ref.name.slice(slash + 1) : ref.name;
    groups.push({ name: ref.name, displayName, local: false, remote: true });
  }

  const tagList = graphRefs.filter(r => r.refType === 'tag').map(r => r.name);

  // Smart branch: prioritize current branch in the 2-badge slot
  const orderedGroups = smartBranch
    ? (() => {
        const idx = groups.findIndex(g => g.name === currentBranch);
        if (idx > 0) return [groups[idx], ...groups.slice(0, idx), ...groups.slice(idx + 1)];
        return groups;
      })()
    : groups;

  const showGroups = orderedGroups.slice(0, 2);
  const showTags = tagList.slice(0, Math.max(0, 2 - showGroups.length));
  const extra = (orderedGroups.length - showGroups.length) + (tagList.length - showTags.length);
  const allNames = [...orderedGroups.map(g => g.displayName), ...tagList].join(', ');
  const totalBadges = showGroups.length + showTags.length;
  const badgeMaxW = totalBadges <= 1 ? 130 : 64;

  const badgeBg = selected ? `${laneColor}55` : `${laneColor}38`;
  const badgeText = selected ? '#ffffff' : laneColor;
  const badgeBorder = selected ? `1px solid ${laneColor}cc` : `1px solid ${laneColor}70`;
  // Remote-only badges are visually dimmer
  const remoteBg = selected ? `${laneColor}33` : `${laneColor}22`;
  const remoteText = selected ? `${laneColor}cc` : `${laneColor}99`;
  const remoteBorder = `1px solid ${laneColor}44`;

  const onEnter = (
    e: React.MouseEvent,
    name: string,
    opts: { local?: boolean; remote?: boolean; isTag?: boolean },
    bg: string, fg: string, bdr: string,
  ) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover({ x: r.left, y: r.top, h: r.height, name, ...opts, bg, fg, bdr });
  };

  return (
    <>
      <div
        className="flex shrink-0 items-center justify-end gap-0.5 overflow-hidden px-1"
        style={{ width: branchColW }}
        onMouseLeave={() => setHover(null)}
      >
        {isHead && (
          <span className="shrink-0 text-[11px] font-bold leading-none text-yellow-400">✓</span>
        )}
        {showGroups.map(g => {
          const isRemoteOnly = !g.local && g.remote;
          const bg = isRemoteOnly ? remoteBg : badgeBg;
          const fg = isRemoteOnly ? remoteText : badgeText;
          const bdr = isRemoteOnly ? remoteBorder : badgeBorder;
          return (
            <span
              key={g.name}
              className="flex min-w-0 cursor-default items-center gap-1 rounded px-1.5 leading-[19px] text-[12px] font-semibold"
              style={{ maxWidth: badgeMaxW, background: bg, color: fg, border: bdr }}
              onMouseEnter={e => onEnter(e, g.name, { local: g.local, remote: g.remote }, bg, fg, bdr)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onBranchContextMenu?.(e, g.name, g.local, g.remote); }}
            >
              <span className="min-w-0 truncate">{g.displayName}</span>
              {g.local && <Monitor size={10} className="shrink-0 opacity-80" />}
              {g.remote && <Cloud size={10} className="shrink-0 opacity-80" />}
            </span>
          );
        })}
        {showTags.map(tag => (
          <span
            key={tag}
            className="flex min-w-0 cursor-default items-center gap-1 rounded px-1.5 leading-[19px] text-[12px] font-semibold"
            style={{ maxWidth: badgeMaxW, background: '#a78bfa38', color: '#c4b5fd', border: '1px solid #a78bfa70' }}
            onMouseEnter={e => onEnter(e, tag, { isTag: true }, '#a78bfa38', '#c4b5fd', '1px solid #a78bfa70')}
          >
            <span className="min-w-0 truncate">{tag}</span>
            <Tag size={10} className="shrink-0 opacity-80" />
          </span>
        ))}
        {extra > 0 && (
          <span
            className="shrink-0 cursor-default rounded px-0.5 text-[9px] text-slate-500"
            onMouseEnter={e => onEnter(e, allNames, {}, '#1e2633', '#94a3b8', '1px solid #334155')}
          >
            +{extra}
          </span>
        )}
      </div>
      {hover && <ExpandedBadge b={hover} />}
    </>
  );
}

const GraphRow = memo(function GraphRow({
  row,
  selected,
  dimmed,
  maxTotal,
  isActiveLane,
  onClick,
  onContextMenu,
  onBranchContextMenu,
  branchColW,
  graphColW,
  changesW,
  authorW,
  dateW,
  shaW,
  smartBranch,
  currentBranch,
}: {
  row: RowData;
  selected: boolean;
  dimmed: boolean;
  maxTotal: number;
  isActiveLane: boolean;
  onClick: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onBranchContextMenu?: (e: ReactMouseEvent, name: string, local: boolean, remote: boolean) => void;
  branchColW: number;
  graphColW: number;
  changesW: number;
  authorW: number;
  dateW: number;
  shaW: number;
  smartBranch: boolean;
  currentBranch: string;
}) {
  const ins = row.commit.insertions ?? 0;
  const del = row.commit.deletions ?? 0;
  const lane = row.graph?.lane ?? 0;
  const lci = row.graph?.colorIndex ?? 0;
  const bandColor = LANE_COLORS[lci % LANE_COLORS.length];
  const lcx = branchColW + laneX(lane);
  const graphRight = branchColW + graphColW;
  const bandGradient = isActiveLane
    ? `linear-gradient(90deg, transparent ${Math.max(0, lcx - 20)}px, ${bandColor}0e ${lcx}px, ${bandColor}12 ${lcx + 12}px, ${bandColor}09 ${Math.min(lcx + 55, graphRight - 20)}px, transparent ${graphRight}px)`
    : undefined;

  return (
    <button
      type="button"
      draggable={false}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`flex w-full select-none items-center border-t border-pilot-line/60 text-left transition-colors hover:bg-[#21262d]/60 ${selected ? 'bg-teal-900/70 text-white hover:bg-teal-900/70' : 'text-slate-300'} ${dimmed ? 'opacity-35' : ''}`}
      style={{ height: ROW_H, backgroundImage: selected ? undefined : bandGradient }}
    >
      {/* Branch column — leftmost */}
      <BranchCell
        row={row}
        selected={selected}
        onBranchContextMenu={onBranchContextMenu}
        smartBranch={smartBranch}
        currentBranch={currentBranch}
        branchColW={branchColW}
      />

      {/* Graph column — empty placeholder; graph rendered in shared GraphLayer above */}
      {graphColW > 0 && <div className="shrink-0" style={{ width: graphColW }} />}

      {/* Message column */}
      <div className="flex min-w-0 flex-1 items-center px-1.5">
        <div className={`truncate text-xs ${selected ? 'font-medium text-white' : 'text-slate-200'}`}>
          {row.commit.message}
        </div>
      </div>

      {/* Changes column */}
      {changesW > 0 && (
        <div className="shrink-0 overflow-hidden" style={{ width: changesW }}>
          <ChangesBar ins={ins} del={del} maxTotal={maxTotal} />
        </div>
      )}

      {/* Author column */}
      {authorW > 0 && (
        <div
          className={`shrink-0 overflow-hidden px-2 text-[11px] ${selected ? 'text-white' : 'text-slate-400'}`}
          style={{ width: authorW }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`h-4 w-4 shrink-0 rounded text-center text-[9px] font-bold leading-4 ${selected ? 'bg-white/20 text-white' : 'bg-[#21262d] text-slate-300'}`}
            >
              {row.commit.author.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{row.commit.author}</span>
          </div>
        </div>
      )}

      {/* Date column */}
      {dateW > 0 && (
        <div
          className={`shrink-0 px-2 text-[11px] ${selected ? 'text-slate-200' : 'text-slate-400'}`}
          style={{ width: dateW }}
        >
          {relativeDate(row.commit.date)}
        </div>
      )}

      {/* Hash column */}
      {shaW > 0 && (
        <div
          className={`shrink-0 px-2 font-mono text-[10px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}
          style={{ width: shaW }}
        >
          {row.commit.shortHash}
        </div>
      )}
    </button>
  );
});

export function GitGraph() {
  const repo = useGitStore(s => s.repo?.path);
  const history = useGitStore(s => s.history);
  const graphData = useGitStore(s => s.graphData);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const selectCommit = useGitStore(s => s.selectCommit);
  const historyLimit = useGitStore(s => s.historyLimit);
  const historyFilters = useGitStore(s => s.historyFilters);
  const status = useGitStore(s => s.status);
  const currentBranch = useGitStore(s => s.status.currentBranch || s.repo?.currentBranch || 'current branch');
  const loadHistory = useGitStore(s => s.loadHistory);
  const fetchAll = useGitStore(s => s.fetchAll);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);
  const [fetching, setFetching] = useState(false);
  const loadingMoreRef = useRef(false);
  const [configOpen, setConfigOpen] = useState(false);
  const closeConfig = useCallback(() => setConfigOpen(false), []);

  const { columns: cols, compactGraph, smartBranch } = useLayoutStore();
  const effectiveBranchW = cols.branch && !compactGraph ? BRANCH_COL_W : 0;
  const effectiveGraphW = cols.graph ? GRAPH_COL_W : 0;
  const effectiveChangesW = cols.changes ? CHANGES_W : 0;
  const effectiveAuthorW = cols.author ? AUTHOR_W : 0;
  const effectiveDateW = cols.date ? DATE_W : 0;
  const effectiveShaW = cols.sha ? HASH_W : 0;

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>(historyFilters);
  const [dimMerges, setDimMerges] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [menu, setMenu] = useState<{ x: number; y: number; commit: CommitInfo }>();
  const [branchMenu, setBranchMenu] = useState<{ x: number; y: number; name: string; local: boolean; remote: boolean }>();
  const listRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);
  const lastAutoScrolledHashRef = useRef<string | undefined>();

  const changedCount =
    status.staged.length + status.unstaged.length + status.untracked.length + status.conflicted.length;

  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (JSON.stringify(filters) === JSON.stringify(historyFilters)) return;
    const id = window.setTimeout(() => { void loadHistory(filters, historyLimit); }, 350);
    return () => window.clearTimeout(id);
  }, [filters, historyFilters, historyLimit, loadHistory]);

  const rows = useMemo((): RowData[] => {
    const graphMap = new Map(graphData.map(r => [r.sha, r]));
    return history.map(commit => ({
      commit,
      graph: graphMap.get(commit.hash) ?? null,
    }));
  }, [history, graphData]);
  const repoDateRange = useMemo(() => {
    const dates = history.map(c => c.date).filter(Boolean).sort();
    if (!dates.length) return undefined;
    const parseD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    return { min: parseD(dates[0]), max: parseD(dates[dates.length - 1]) };
  }, [history]);

  const authors = useMemo(() => Array.from(new Set(history.map(c => c.author))).sort(), [history]);
  const refs = useMemo(() => Array.from(new Set(history.flatMap(c => c.refs.map(cleanRef)))).sort(), [history]);
  const visibleRows = useMemo(() => rows.filter(row => matchesCommit(row.commit, search)), [rows, search]);
  const hasFilter = Boolean(search || filters.branch || filters.author || filters.since || filters.until || filters.keyword || filters.filePath);

  const maxTotal = useMemo(() =>
    Math.max(1, ...history.map(c => (c.insertions ?? 0) + (c.deletions ?? 0))),
    [history]
  );

  // Map lane → branch name: first (newest) branch ref found on each lane, used as ghost label fallback
  const laneLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const gRow of graphData) {
      if (!map.has(gRow.lane) && gRow.refs.length > 0) {
        const ref = gRow.refs.find(r => r.refType === 'local') ?? gRow.refs.find(r => r.refType === 'remote');
        if (ref) map.set(gRow.lane, ref.name);
      }
    }
    return map;
  }, [graphData]);

  // Active lane: lane of current branch (for focus/dim effect)
  const activeLane = useMemo(() => {
    for (const [lane, name] of laneLabels.entries()) {
      if (name === currentBranch) return lane;
    }
    const headRow = graphData.find(r => r.isHead);
    return headRow?.lane ?? -1;
  }, [laneLabels, currentBranch, graphData]);

  // Virtual scroll
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(visibleRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + OVERSCAN);
  const renderedRows = visibleRows.slice(startIndex, endIndex);
  const wdRowH = changedCount > 0 ? ROW_H : 0;
  const hasMoreCommits = history.length >= historyLimit;
  const totalListHeight = visibleRows.length * ROW_H + (hasMoreCommits ? 32 : 0);

  const handleFetch = async () => {
    setFetching(true);
    try { await fetchAll(); } finally { setFetching(false); }
  };

  // Auto-load more when scroll near bottom
  useEffect(() => {
    if (!hasMoreCommits || loadingMoreRef.current) return;
    if (scrollTop + viewportHeight * 3 >= visibleRows.length * ROW_H) {
      loadingMoreRef.current = true;
      void loadHistory(filters, historyLimit + 500).finally(() => { loadingMoreRef.current = false; });
    }
  }, [scrollTop, viewportHeight, visibleRows.length, hasMoreCommits, historyLimit, filters, loadHistory]);

  const clear = () => { setSearch(''); setFilters({}); };
  const ask = (message: string, fallback: string) => prompt(message, fallback)?.trim();
  const commitRevision = (commit: CommitInfo) => commit.hash.trim() || commit.shortHash.trim();
  const runCommitAction = (label: string, commit: CommitInfo, fn: (revision: string) => Promise<unknown>) => {
    const revision = commitRevision(commit);
    if (!repo || !revision) return;
    void run(label, () => fn(revision));
  };
  const separator = (label: string): ContextMenuItem => ({ label, separator: true, action: () => undefined });
  const copyText = (label: string, value: string) => {
    if (!value) return;
    void navigator.clipboard.writeText(value).then(() => log(`${label}: ${value}`)).catch(() => log(value));
  };

  const commitMenuItems = (commit: CommitInfo): ContextMenuItem[] => {
    const revision = commitRevision(commit);
    const short = commit.shortHash || revision.slice(0, 8);

    const cleaned = commit.refs.map(r => cleanRef(r)).filter(r => r !== 'HEAD' && !r.startsWith('tag:'));
    // Local branches: no slash
    const localBranches = cleaned.filter(r => !r.includes('/'));
    // Remote branches: strip remote-name prefix → local name to checkout/track
    const remoteBranches = cleaned
      .filter(r => r.includes('/') && !r.endsWith('/HEAD'))
      .map(r => ({ remote: r, local: r.slice(r.indexOf('/') + 1) }))
      .filter(({ local }) => !localBranches.includes(local)); // skip if local already listed

    const checkoutBranch = (name: string) =>
      repo && void run(`checkout ${name}`, () => gitService.checkoutBranch(repo, name));

    return [
      ...localBranches.map(branch => ({
        label: `Checkout  ${branch}`,
        action: () => checkoutBranch(branch),
      })),
      ...remoteBranches.map(({ remote, local }) => ({
        label: `Checkout  ${local}  ← ${remote}`,
        action: () => checkoutBranch(local),
      })),
      {
        label: localBranches.length + remoteBranches.length > 0 ? 'Checkout (detached HEAD)' : 'Checkout this commit',
        action: () => {
          if (confirm(`Checkout ${short} in detached HEAD?`))
            runCommitAction('checkout commit', commit, rev => gitService.checkoutCommit(repo!, rev));
        },
      },
      {
        label: 'Create worktree from this commit',
        action: () => {
          const path = ask('Worktree path', `../worktree-${short}`);
          if (path) runCommitAction('create worktree', commit, rev => gitService.createWorktree(repo!, path, rev, false));
        },
      },
      separator('commit-actions'),
      {
        label: 'Create branch here',
        action: () => {
          const name = ask('New branch name', `branch-${short}`);
          if (name) runCommitAction('branch from commit', commit, rev => gitService.createBranchFromCommit(repo!, name, rev, true));
        },
      },
      {
        label: 'Cherry pick commit',
        action: () => runCommitAction('cherry-pick', commit, rev => gitService.cherryPickCommit(repo!, rev)),
      },
      {
        label: `Rebase ${currentBranch} onto this commit`,
        action: () => {
          if (confirm(`Rebase ${currentBranch} onto ${short}?`))
            runCommitAction('rebase', commit, rev => gitService.startRebase(repo!, rev));
        },
      },
      {
        label: `Reset ${currentBranch} to this commit: soft`,
        action: () => {
          if (confirm(`Soft reset ${currentBranch} to ${short}?`))
            runCommitAction('soft reset', commit, rev => gitService.resetToCommit(repo!, rev, 'soft'));
        },
      },
      {
        label: `Reset ${currentBranch} to this commit: mixed`,
        action: () => {
          if (confirm(`Mixed reset ${currentBranch} to ${short}?`))
            runCommitAction('mixed reset', commit, rev => gitService.resetToCommit(repo!, rev, 'mixed'));
        },
      },
      {
        label: `Reset ${currentBranch} to this commit: hard`,
        danger: true,
        action: () => {
          if (confirm(`Hard reset ${currentBranch} to ${short}? This can discard work.`))
            runCommitAction('hard reset', commit, rev => gitService.resetToCommit(repo!, rev, 'hard'));
        },
      },
      {
        label: 'Revert commit',
        danger: true,
        action: () => {
          if (confirm(`Revert ${short}?`))
            runCommitAction('revert commit', commit, rev => gitService.revertCommit(repo!, rev));
        },
      },
      separator('copy-patch'),
      {
        label: 'Copy commit sha',
        action: () => copyText('Copied commit sha', revision),
      },
      {
        label: 'Create patch from commit',
        action: () => runCommitAction('create patch', commit, rev => gitService.createPatchFromCommit(repo!, rev)),
      },
      separator('tag-actions'),
      {
        label: 'Create tag here',
        action: () => {
          const name = ask('New tag name', `tag-${short}`);
          if (name) runCommitAction('tag commit', commit, rev => gitService.createTagFromCommit(repo!, name, rev));
        },
      },
      {
        label: 'Create annotated tag here',
        action: () => {
          const name = ask('New annotated tag name', `tag-${short}`);
          if (!name) return;
          const message = ask('Tag message', name);
          if (message)
            runCommitAction('annotated tag', commit, rev =>
              gitService.createAnnotatedTagFromCommit(repo!, name, message, rev));
        },
      },
    ];
  };

  const branchMenuItems = (name: string, isLocal: boolean, isRemote: boolean): ContextMenuItem[] => {
    const isCurrent = name === currentBranch;
    const items: ContextMenuItem[] = [];

    // Switch
    if (isCurrent) {
      items.push({ label: `✓ ${name}`, disabled: true, action: () => undefined });
    } else if (isLocal) {
      items.push({ header: true, label: 'Switch', action: () => undefined });
      items.push({ label: `Checkout ${name}`, action: () => repo && void run('checkout branch', () => gitService.checkoutBranch(repo!, name)) });
    } else if (isRemote) {
      const local = name.includes('/') ? name.slice(name.indexOf('/') + 1) : name;
      items.push({ header: true, label: 'Switch', action: () => undefined });
      items.push({ label: `Checkout ${local} ← ${name}`, action: () => repo && void run('checkout branch', () => gitService.checkoutBranch(repo!, local)) });
    }

    // Actions on current branch using this branch
    if (isLocal && !isCurrent) {
      items.push(separator('branch-actions'));
      items.push({ header: true, label: 'Actions', action: () => undefined });
      items.push({
        label: `Merge ${name} → ${currentBranch}`,
        action: () => { if (confirm(`Merge ${name} into ${currentBranch}?`)) repo && void run('merge branch', () => gitService.mergeBranch(repo!, name)); },
      });
      items.push({
        label: `Rebase ${currentBranch} onto ${name}`,
        action: () => { if (confirm(`Rebase ${currentBranch} onto ${name}?`)) repo && void run('rebase', () => gitService.startRebase(repo!, name)); },
      });
    }

    // Manage
    if (isLocal) {
      items.push(separator('manage'));
      items.push({ header: true, label: 'Manage', action: () => undefined });
      items.push({
        label: 'Rename branch',
        action: () => {
          const next = prompt('New branch name', name)?.trim();
          if (next && repo) void run('rename branch', () => gitService.renameBranch(repo!, name, next));
        },
      });
      if (!isCurrent) {
        items.push({
          label: 'Delete branch',
          danger: true,
          action: () => { if (confirm(`Delete ${name}?`)) repo && void run('delete branch', () => gitService.deleteBranch(repo!, name, false)); },
        });
        items.push({
          label: 'Force delete branch',
          danger: true,
          action: () => { if (confirm(`Force delete ${name}?`)) repo && void run('force delete branch', () => gitService.deleteBranch(repo!, name, true)); },
        });
      }
    }

    items.push(separator('copy'));
    items.push({ label: 'Copy branch name', action: () => void navigator.clipboard.writeText(name) });
    return items;
  };

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => setViewportHeight(list.clientHeight || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(list);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !selectedCommit) return;
    if (lastAutoScrolledHashRef.current === selectedCommit.hash) return;
    const idx = visibleRows.findIndex(row => row.commit.hash === selectedCommit.hash);
    if (idx === -1) return;
    lastAutoScrolledHashRef.current = selectedCommit.hash;
    const rowTop = idx * ROW_H;
    const rowBottom = rowTop + ROW_H;
    if (rowTop < list.scrollTop) list.scrollTop = rowTop;
    else if (rowBottom > list.scrollTop + list.clientHeight) list.scrollTop = rowBottom - list.clientHeight;
  }, [selectedCommit?.hash, visibleRows]);

  if (history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Open a repository to see commit history
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-pilot-bg">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-pilot-line bg-[#161b22]">
        <div className="flex items-center gap-0">
          {/* HISTORY label + count */}
          <div className="flex shrink-0 items-center gap-2 border-r border-pilot-line px-3 py-2">
            <GitCommitHorizontal size={13} className="text-slate-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">History</span>
            <span className="rounded bg-[#21262d] px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
              {visibleRows.length}
            </span>
          </div>

          {/* Filter controls */}
          <div className="flex h-10 flex-1 items-center gap-1.5 px-2">
            {/* Branch filter */}
            <div className="relative w-36 shrink-0">
              <select
                className="input h-7 w-full cursor-pointer appearance-none pr-6 text-[11px]"
                value={filters.branch ?? ''}
                onChange={e => setFilters(f => ({ ...f, branch: e.target.value || undefined }))}
              >
                <option value="">all branches</option>
                {refs.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-2 text-slate-500" />
            </div>

            {/* Author filter */}
            <div className="relative hidden w-32 shrink-0 xl:block">
              <select
                className="input h-7 w-full cursor-pointer appearance-none pr-6 text-[11px]"
                value={filters.author ?? ''}
                onChange={e => setFilters(f => ({ ...f, author: e.target.value || undefined }))}
              >
                <option value="">all authors</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-2 text-slate-500" />
            </div>

            {/* Search */}
            <label className="relative min-w-0 flex-1">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input h-7 w-full pl-7 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
              />
            </label>

            {/* Fetch button */}
            <button
              className={`icon-btn h-7 shrink-0 gap-1 ${fetching ? 'opacity-60' : ''}`}
              onClick={() => void handleFetch()}
              disabled={fetching || !repo}
              title="Fetch all remotes"
            >
              <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
              <span className="hidden lg:inline">Fetch</span>
            </button>

            {/* Dim merges toggle */}
            <button
              className={`icon-btn h-7 shrink-0 gap-1 ${dimMerges ? 'accent' : ''}`}
              onClick={() => setDimMerges(v => !v)}
              title={dimMerges ? 'Show merge commits' : 'Dim merge commits'}
            >
              <EyeOff size={12} />
              <span className="hidden lg:inline">Merges</span>
            </button>

            {hasFilter && (
              <button className="icon-btn h-7 shrink-0" onClick={clear} title="Clear filters">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Column headers */}
      <div className="relative flex shrink-0 select-none border-b border-pilot-line bg-pilot-bg text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {effectiveBranchW > 0 && <div className="shrink-0 px-2 py-1.5" style={{ width: effectiveBranchW }}>Branch</div>}
        {effectiveGraphW > 0 && <div className="shrink-0" style={{ width: effectiveGraphW }} />}
        <div className="min-w-0 flex-1 px-2 py-1.5">Commit</div>
        {effectiveChangesW > 0 && <div className="shrink-0 px-2 py-1.5" style={{ width: effectiveChangesW }}>Changes</div>}
        {effectiveAuthorW > 0 && <div className="shrink-0 px-2 py-1.5" style={{ width: effectiveAuthorW }}>Author</div>}
        {effectiveDateW > 0 && <div className="shrink-0 px-2 py-1.5" style={{ width: effectiveDateW }}>Date</div>}
        {effectiveShaW > 0 && <div className="shrink-0 px-2 py-1.5" style={{ width: effectiveShaW }}>SHA</div>}
        <div className="relative shrink-0">
          <button
            className={`flex h-full items-center px-2 py-1.5 hover:text-slate-400 ${configOpen ? 'text-sky-400' : ''}`}
            title="Configure columns"
            onClick={() => setConfigOpen(v => !v)}
          >
            <Settings2 size={11} />
          </button>
          {configOpen && (
              <ColumnConfigMenu
                onClose={closeConfig}
                filters={filters}
                onFiltersChange={f => setFilters(f)}
                hasActiveFilter={Boolean(filters.since || filters.until || filters.keyword || filters.filePath)}
                onClearFilters={() => setFilters({})}
                minDate={repoDateRange?.min}
                maxDate={repoDateRange?.max}
              />
            )}
        </div>
      </div>

      {/* Commit list */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 select-none overflow-auto [overflow-anchor:none]"
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        {/* Working Directory row — GitKraken WIP style */}
        {changedCount > 0 && (
          <button
            type="button"
            className="flex w-full select-none items-center border-b border-pilot-line/60 text-left transition-colors hover:bg-[#21262d]/60"
            style={{ height: wdRowH, background: 'linear-gradient(90deg, #1c2128 0%, #0d1117 100%)' }}
            onClick={() => useGitStore.setState({ rightPanelTab: 'working' })}
          >
            {/* Branch placeholder */}
            {effectiveBranchW > 0 && <div className="shrink-0" style={{ width: effectiveBranchW }} />}
            {/* WIP dot — white diamond-ish */}
            {effectiveGraphW > 0 && (
              <div className="shrink-0 overflow-hidden" style={{ width: effectiveGraphW }}>
                <svg width={GRAPH_W} height={wdRowH} className="block overflow-hidden">
                  <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R + 3} fill="#ffffff" opacity={0.08} />
                  <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R} fill="#e2e8f0" />
                  <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R - 1.5} fill="#0d1117" />
                  <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R - 1.5} fill="#e2e8f0" opacity={0.4} />
                </svg>
              </div>
            )}

            {/* WIP label */}
            <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
              <span className="shrink-0 font-mono text-[11px] font-semibold text-slate-400">// WIP</span>
              <span className="flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                <Pencil size={9} />
                {changedCount}
              </span>
              <span className="truncate text-xs text-slate-500">
                {changedCount} file{changedCount === 1 ? '' : 's'} modified
              </span>
            </div>

            {/* Changes placeholder */}
            {effectiveChangesW > 0 && <div className="shrink-0" style={{ width: effectiveChangesW }} />}

            {/* Author: no avatar for WIP */}
            {effectiveAuthorW > 0 && (
              <div className="shrink-0 px-2 text-[11px] text-slate-600" style={{ width: effectiveAuthorW }}>
                working tree
              </div>
            )}
            {effectiveDateW > 0 && (
              <div className="shrink-0 px-2 text-[10px] text-slate-600" style={{ width: effectiveDateW }}>now</div>
            )}
            {effectiveShaW > 0 && (
              <div className="shrink-0 px-2 font-mono text-[10px] text-slate-600" style={{ width: effectiveShaW }}>HEAD</div>
            )}
          </button>
        )}

        {/* Virtual scrolled commit rows */}
        <div className="relative" style={{ height: totalListHeight }}>
          {/* Shared graph SVG layer — renders all lane lines/nodes without per-row clipping */}
          {effectiveGraphW > 0 && <GraphLayer rows={renderedRows} startIndex={startIndex} laneLabels={laneLabels} activeLane={activeLane} left={effectiveBranchW} />}

          {renderedRows.map((row, i) => {
            const index = startIndex + i;
            const selected = Boolean(selectedCommit?.hash && selectedCommit.hash === commitRevision(row.commit));
            const dimmed = dimMerges && !selected && isMergeCommit(row.commit);
            return (
              <div
                key={`${row.commit.hash || row.commit.shortHash}-${index}`}
                className="absolute left-0 right-0"
                style={{ top: index * ROW_H, height: ROW_H }}
              >
                <GraphRow
                  row={row}
                  selected={selected}
                  dimmed={dimmed}
                  maxTotal={maxTotal}
                  isActiveLane={activeLane < 0 || (row.graph?.lane ?? -1) === activeLane}
                  onClick={() => {
                    void selectCommit(row.commit);
                    useGitStore.setState({ rightPanelTab: 'review' });
                  }}
                  onContextMenu={event => {
                    event.preventDefault();
                    void selectCommit(row.commit);
                    useGitStore.setState({ rightPanelTab: 'review' });
                    setMenu({ x: event.clientX, y: event.clientY, commit: row.commit });
                  }}
                  onBranchContextMenu={(e, name, local, remote) => {
                    e.stopPropagation();
                    setBranchMenu({ x: e.clientX, y: e.clientY, name, local, remote });
                  }}
                  branchColW={effectiveBranchW}
                  graphColW={effectiveGraphW}
                  changesW={effectiveChangesW}
                  authorW={effectiveAuthorW}
                  dateW={effectiveDateW}
                  shaW={effectiveShaW}
                  smartBranch={smartBranch}
                  currentBranch={currentBranch}
                />
              </div>
            );
          })}
          {visibleRows.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">No commits match the current filters.</div>
          )}
          {hasMoreCommits && (
            <div
              className="absolute left-0 right-0 flex items-center justify-center border-t border-pilot-line"
              style={{ top: visibleRows.length * ROW_H, height: 32 }}
            >
              <span className="text-[10px] text-slate-600 select-none">loading…</span>
            </div>
          )}
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={menu.commit.shortHash}
          onClose={() => setMenu(undefined)}
          items={commitMenuItems(menu.commit)}
        />
      )}
      {branchMenu && (
        <ContextMenu
          x={branchMenu.x}
          y={branchMenu.y}
          title={branchMenu.name}
          onClose={() => setBranchMenu(undefined)}
          items={branchMenuItems(branchMenu.name, branchMenu.local, branchMenu.remote)}
        />
      )}
    </div>
  );
}
