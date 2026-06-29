import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, GitCommitHorizontal, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { CommitInfo, HistoryFilters } from '../../types/git';

const LANE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#4ade80', '#e879f9', '#f87171'];
const ROW_H = 34;
// git log --graph uses 2 chars per lane: '* ' '| ' '/ ' '\ '
// LANE_W = pixel distance between adjacent lane centres
const LANE_W = 16;
const CIRCLE_R = 4;
const STROKE_W = 1.5;
const PAD_LEFT = 10;
const OVERSCAN = 8;
const MAX_LANES = 12;
const MAX_GRAPH_CHARS = MAX_LANES * 2;
const GRAPH_W = MAX_LANES * LANE_W + PAD_LEFT * 2;
const GRAPH_COL_W = GRAPH_W + 4;
const AUTHOR_W = 130;
const DATE_W = 70;
const HASH_W = 68;
const LOAD_MORE_H = 58;

type GraphSegment = {
  kind: 'vertical' | 'slash' | 'backslash' | 'horizontal';
  col: number;
  color: string;
};

type RowData = {
  commit: CommitInfo;
  nodeCol: number;
  color: string;
  segments: GraphSegment[];
};

function buildRows(commits: CommitInfo[]): RowData[] {
  return commits.map(commit => {
    const graph = commit.graph || '*';
    const chars = Array.from(graph.slice(0, MAX_GRAPH_CHARS));
    const rawNodeCol = chars.findIndex(ch => ch === '*');
    const nodeCol = rawNodeCol >= 0 ? rawNodeCol : 0;
    const colorForCol = (col: number) => LANE_COLORS[Math.floor(Math.max(0, col) / 2) % LANE_COLORS.length];
    const color = colorForCol(nodeCol);
    const segments: GraphSegment[] = [];

    chars.forEach((ch, col) => {
      if (ch === '|') segments.push({ kind: 'vertical', col, color: colorForCol(col) });
      else if (ch === '/') segments.push({ kind: 'slash', col, color: colorForCol(col + 1) });
      else if (ch === '\\') segments.push({ kind: 'backslash', col, color: colorForCol(col) });
      else if (ch === '_' || ch === '-') segments.push({ kind: 'horizontal', col, color });
    });

    return { commit, nodeCol, color, segments };
  });
}

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

function refClassName(ref: string, selected: boolean) {
  if (selected) return 'bg-white/20 text-white';
  if (ref.includes('HEAD')) return 'bg-yellow-500/20 text-yellow-300';
  if (ref.includes('origin/')) return 'bg-emerald-500/15 text-emerald-300';
  if (ref.startsWith('tag:')) return 'bg-violet-500/15 text-violet-300';
  return 'bg-sky-500/15 text-sky-200';
}

// lane centre x = PAD_LEFT + laneIndex * LANE_W
// git graph char col c → laneIndex = floor(c / 2)
const laneX = (charCol: number) => PAD_LEFT + Math.floor(Math.max(0, charCol) / 2) * LANE_W;

// Straight-curve-straight path: lines stay parallel most of the row,
// only curve briefly near the midpoint — matches GitKraken style.
function transPath(x1: number, x2: number, h: number): string {
  if (x1 === x2) return `M ${x1} 0 L ${x1} ${h}`;
  const bend = h * 0.38;
  return `M ${x1} 0 L ${x1} ${bend} C ${x1} ${h / 2} ${x2} ${h / 2} ${x2} ${h - bend} L ${x2} ${h}`;
}

function GraphSvg({ row, height }: { row: RowData; height: number }) {
  const cy = height / 2;
  const cx = laneX(row.nodeCol);

  return (
    <svg width={GRAPH_W} height={height} className="block overflow-hidden" shapeRendering="geometricPrecision">
      {row.segments.map((seg, i) => {
        if (seg.kind === 'vertical') {
          const x = laneX(seg.col);
          return (
            <line key={i} x1={x} y1={0} x2={x} y2={height}
              stroke={seg.color} strokeWidth={STROKE_W} strokeLinecap="square" />
          );
        }
        if (seg.kind === 'backslash') {
          // '\' at col c: from lane floor((c-1)/2) top → lane floor((c+1)/2) bottom
          const xa = laneX(seg.col - 1);
          const xb = laneX(seg.col + 1);
          return (
            <path key={i} d={transPath(xa, xb, height)}
              stroke={seg.color} strokeWidth={STROKE_W} fill="none" strokeLinecap="square" />
          );
        }
        if (seg.kind === 'slash') {
          // '/' at col c: from lane floor((c+1)/2) top → lane floor((c-1)/2) bottom
          const xa = laneX(seg.col + 1);
          const xb = laneX(seg.col - 1);
          return (
            <path key={i} d={transPath(xa, xb, height)}
              stroke={seg.color} strokeWidth={STROKE_W} fill="none" strokeLinecap="square" />
          );
        }
        // horizontal
        const x = laneX(seg.col);
        return (
          <line key={i} x1={x} y1={cy} x2={laneX(seg.col + 2)} y2={cy}
            stroke={seg.color} strokeWidth={STROKE_W} strokeLinecap="square" />
        );
      })}

      {/* node outgoing (down) */}
      {row.commit.parents.length > 0 && (
        <line x1={cx} y1={cy} x2={cx} y2={height}
          stroke={row.color} strokeWidth={STROKE_W} strokeLinecap="square" />
      )}
      {/* node incoming (up) */}
      {row.commit.graph.includes('|') && (
        <line x1={cx} y1={0} x2={cx} y2={cy}
          stroke={row.color} strokeWidth={STROKE_W} strokeLinecap="square" />
      )}

      {/* node dot — drawn last so it covers lines */}
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={row.color} />
      <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill="#090e1b" />
      <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill={row.color} opacity={0.5} />
      {/* HEAD ring */}
      {row.commit.head && (
        <circle cx={cx} cy={cy} r={CIRCLE_R + 2} fill="none" stroke={row.color} strokeWidth={1.5} opacity={0.7} />
      )}
    </svg>
  );
}

const GraphRow = memo(function GraphRow({
  row,
  selected,
  onClick,
  onContextMenu,
}: {
  row: RowData;
  selected: boolean;
  onClick: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  const refs = row.commit.refs.slice(0, 4);
  const hasExtraRefs = row.commit.refs.length > refs.length;

  return (
    <button
      type="button"
      draggable={false}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`flex w-full select-none items-center border-t border-pilot-line/60 text-left transition-colors hover:bg-slate-800/50 ${selected ? 'bg-sky-700/90 text-white hover:bg-sky-700/90' : 'text-slate-300'}`}
      style={{ height: ROW_H }}
    >
      {/* Graph column */}
      <div className="shrink-0 overflow-hidden" style={{ width: GRAPH_COL_W }}>
        <GraphSvg row={row} height={ROW_H} />
      </div>

      {/* Message + refs column */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-1.5">
        {refs.length > 0 && (
          <div className="flex items-center gap-1">
            {refs.map(ref => (
              <span
                key={ref}
                className={`shrink-0 truncate rounded px-1 py-0 text-[9px] font-semibold leading-4 ${refClassName(ref, selected)}`}
                style={{ maxWidth: 100 }}
              >
                {cleanRef(ref)}
              </span>
            ))}
            {hasExtraRefs && (
              <span className={`rounded px-1 py-0 text-[9px] leading-4 ${selected ? 'bg-white/15 text-white' : 'bg-slate-700 text-slate-400'}`}>
                +{row.commit.refs.length - refs.length}
              </span>
            )}
          </div>
        )}
        <div className={`truncate text-xs ${selected ? 'font-medium text-white' : 'text-slate-200'}`}>
          {row.commit.message}
        </div>
      </div>

      {/* Author column */}
      <div
        className={`shrink-0 overflow-hidden px-2 text-[11px] ${selected ? 'text-white' : 'text-slate-400'}`}
        style={{ width: AUTHOR_W }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`h-4 w-4 shrink-0 rounded text-center text-[9px] font-bold leading-4 ${selected ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            {row.commit.author.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{row.commit.author}</span>
        </div>
      </div>

      {/* Date column */}
      <div
        className={`shrink-0 px-2 text-[10px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}
        style={{ width: DATE_W }}
      >
        {row.commit.date}
      </div>

      {/* Hash column */}
      <div
        className={`shrink-0 px-2 font-mono text-[10px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}
        style={{ width: HASH_W }}
      >
        {row.commit.shortHash}
      </div>
    </button>
  );
});

export function GitGraph() {
  const repo = useGitStore(s => s.repo?.path);
  const history = useGitStore(s => s.history);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const selectCommit = useGitStore(s => s.selectCommit);
  const historyLimit = useGitStore(s => s.historyLimit);
  const historyFilters = useGitStore(s => s.historyFilters);
  const status = useGitStore(s => s.status);
  const currentBranch = useGitStore(s => s.status.currentBranch || s.repo?.currentBranch || 'current branch');
  const loadHistory = useGitStore(s => s.loadHistory);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>(historyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [menu, setMenu] = useState<{ x: number; y: number; commit: CommitInfo }>();
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

  const rows = useMemo(() => buildRows(history), [history]);
  const authors = useMemo(() => Array.from(new Set(history.map(c => c.author))).sort(), [history]);
  const refs = useMemo(() => Array.from(new Set(history.flatMap(c => c.refs.map(cleanRef)))).sort(), [history]);
  const visibleRows = useMemo(() => rows.filter(row => matchesCommit(row.commit, search)), [rows, search]);
  const hasFilter = Boolean(search || filters.branch || filters.author || filters.since || filters.until || filters.keyword || filters.filePath);

  // Virtual scroll
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(visibleRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + OVERSCAN);
  const renderedRows = visibleRows.slice(startIndex, endIndex);
  const wdRowH = changedCount > 0 ? ROW_H : 0;
  const totalListHeight = visibleRows.length * ROW_H + LOAD_MORE_H;

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
    return [
      {
        label: 'Checkout this commit',
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#090e1b]">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-pilot-line bg-[#0d1324]">
        <div className="flex items-center gap-0">
          {/* HISTORY label + count */}
          <div className="flex shrink-0 items-center gap-2 border-r border-pilot-line px-3 py-2">
            <GitCommitHorizontal size={13} className="text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">History</span>
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
              {visibleRows.length}
            </span>
          </div>

          {/* Filter controls */}
          <div className="flex flex-1 items-center gap-1.5 px-2 py-1.5">
            {/* Branch filter */}
            <div className="relative">
              <select
                className="input h-7 cursor-pointer appearance-none pr-6 text-[11px]"
                value={filters.branch ?? ''}
                onChange={e => setFilters(f => ({ ...f, branch: e.target.value || undefined }))}
              >
                <option value="">all branches</option>
                {refs.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-2 text-slate-500" />
            </div>

            {/* Author filter (hidden on narrow) */}
            <div className="relative hidden xl:block">
              <select
                className="input h-7 cursor-pointer appearance-none pr-6 text-[11px]"
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
              <Search size={12} className="pointer-events-none absolute left-2 top-2 text-slate-500" />
              <input
                className="input h-7 w-full pl-7 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search commits, SHA, author…"
              />
            </label>

            <button
              className={`icon-btn h-7 ${filtersOpen ? 'accent' : ''}`}
              onClick={() => setFiltersOpen(v => !v)}
              title="Advanced filters"
            >
              <SlidersHorizontal size={12} />
            </button>
            {hasFilter && (
              <button className="icon-btn h-7" onClick={clear}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Advanced filters */}
        {filtersOpen && (
          <div className="grid grid-cols-[minmax(120px,150px)_minmax(120px,150px)_1fr_1fr] gap-2 border-t border-pilot-line px-3 py-2">
            <input className="input h-7 text-xs" type="date" value={filters.since ?? ''} onChange={e => setFilters(f => ({ ...f, since: e.target.value || undefined }))} title="Since" />
            <input className="input h-7 text-xs" type="date" value={filters.until ?? ''} onChange={e => setFilters(f => ({ ...f, until: e.target.value || undefined }))} title="Until" />
            <input className="input h-7 text-xs" value={filters.keyword ?? ''} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value || undefined }))} placeholder="Message keyword" />
            <input className="input h-7 text-xs" value={filters.filePath ?? ''} onChange={e => setFilters(f => ({ ...f, filePath: e.target.value || undefined }))} placeholder="File path filter" />
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="flex shrink-0 select-none border-b border-pilot-line bg-[#0b1020] text-[9px] font-bold uppercase tracking-wider text-slate-600">
        <div className="shrink-0" style={{ width: GRAPH_COL_W }} />
        <div className="min-w-0 flex-1 px-2 py-1.5">Commit Message</div>
        <div className="shrink-0 px-2 py-1.5" style={{ width: AUTHOR_W }}>Author</div>
        <div className="shrink-0 px-2 py-1.5" style={{ width: DATE_W }}>Date</div>
        <div className="shrink-0 px-2 py-1.5" style={{ width: HASH_W }}>SHA</div>
      </div>

      {/* Commit list */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 select-none overflow-auto [overflow-anchor:none]"
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        {/* Working Directory row */}
        {changedCount > 0 && (
          <button
            type="button"
            className="flex w-full select-none items-center border-b border-pilot-line/60 bg-slate-800/30 text-left transition-colors hover:bg-slate-800/60"
            style={{ height: wdRowH }}
            onClick={() => useGitStore.setState({ rightPanelTab: 'working' })}
          >
            <div className="shrink-0 overflow-hidden" style={{ width: GRAPH_COL_W }}>
              <svg width={GRAPH_W} height={wdRowH} className="block overflow-hidden">
                <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R + 3} fill="#ffffff" opacity={0.12} />
                <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R} fill="#e2e8f0" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 px-1.5 text-xs font-medium text-slate-300">
              Working Directory
            </div>
            <div className="shrink-0 px-2 text-[11px] text-slate-500" style={{ width: AUTHOR_W }}>
              {changedCount} file{changedCount === 1 ? '' : 's'} changed
            </div>
            <div className="shrink-0 px-2 text-[10px] text-slate-600" style={{ width: DATE_W }}>now</div>
            <div className="shrink-0 px-2 font-mono text-[10px] text-slate-600" style={{ width: HASH_W }}>HEAD</div>
          </button>
        )}

        {/* Virtual scrolled commit rows */}
        <div className="relative" style={{ height: totalListHeight }}>
          {renderedRows.map((row, i) => {
            const index = startIndex + i;
            const selected = Boolean(selectedCommit?.hash && selectedCommit.hash === commitRevision(row.commit));
            return (
              <div
                key={`${row.commit.hash || row.commit.shortHash}-${index}`}
                className="absolute left-0 right-0"
                style={{ top: index * ROW_H, height: ROW_H }}
              >
                <GraphRow
                  row={row}
                  selected={selected}
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
                />
              </div>
            );
          })}
          {visibleRows.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">No commits match the current filters.</div>
          )}
          <div
            className="absolute left-0 right-0 border-t border-pilot-line p-3 text-center"
            style={{ top: visibleRows.length * ROW_H, height: LOAD_MORE_H }}
          >
            <button className="btn" onClick={() => void loadHistory(filters, historyLimit + 500)}>
              Load 500 more commits
            </button>
          </div>
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
    </div>
  );
}
