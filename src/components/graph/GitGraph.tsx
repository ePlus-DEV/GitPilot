import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, EyeOff, GitCommitHorizontal, Pencil, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { CommitGraphRow, CommitInfo, HistoryFilters } from '../../types/git';

const LANE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#4ade80', '#e879f9', '#f87171'];
const ROW_H = 34;
const LANE_W = 16;
const CIRCLE_R = 4;
const STROKE_W = 1.5;
const PAD_LEFT = 10;
const OVERSCAN = 8;
const MAX_LANES = 12;
const MAX_GRAPH_CHARS = MAX_LANES * 2;
const GRAPH_W = MAX_LANES * LANE_W + PAD_LEFT * 2;
const GRAPH_COL_W = GRAPH_W + 4;
const AUTHOR_W = 120;
const DATE_W = 72;
const HASH_W = 64;
const CHANGES_W = 90;
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

function refClassName(ref: string, selected: boolean) {
  if (selected) return 'bg-white/20 text-white';
  if (ref.includes('HEAD')) return 'bg-yellow-500/20 text-yellow-300';
  if (ref.includes('origin/')) return 'bg-emerald-500/15 text-emerald-300';
  if (ref.startsWith('tag:')) return 'bg-violet-500/15 text-violet-300';
  return 'bg-teal-500/15 text-teal-200';
}

const laneX = (col: number) => PAD_LEFT + Math.max(0, col) * LANE_W;

/** Bezier curve from (x1, yMid) to (x2, yEnd) — used for merge/fork edges. */
function edgePath(x1: number, x2: number, yMid: number, yEnd: number): string {
  if (x1 === x2) return `M ${x1} ${yMid} L ${x1} ${yEnd}`;
  const ctrl = yMid + (yEnd - yMid) * 0.6;
  return `M ${x1} ${yMid} C ${x1} ${ctrl} ${x2} ${ctrl} ${x2} ${yEnd}`;
}

function GraphSvg({ row, height }: { row: RowData; height: number }) {
  const cy = height / 2;
  const g = row.graph;

  if (!g) {
    // Fallback: minimal dot when no graph data is available yet
    const cx = PAD_LEFT;
    return (
      <svg width={GRAPH_W} height={height} className="block overflow-hidden" shapeRendering="geometricPrecision">
        <circle cx={cx} cy={cy} r={CIRCLE_R} fill={LANE_COLORS[0]} />
        <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill="#0d1117" />
        <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill={LANE_COLORS[0]} opacity={0.5} />
      </svg>
    );
  }

  const cx = laneX(g.lane);
  const nodeColor = LANE_COLORS[g.colorIndex % LANE_COLORS.length];

  return (
    <svg width={GRAPH_W} height={height} className="block overflow-hidden" shapeRendering="geometricPrecision">
      {/* Lines entering from the row above (top half) */}
      {g.topLines.map(([col, ci], i) => (
        <line key={`t${i}`}
          x1={laneX(col)} y1={0} x2={laneX(col)} y2={cy}
          stroke={LANE_COLORS[ci % LANE_COLORS.length]}
          strokeWidth={STROKE_W} strokeLinecap="round" />
      ))}

      {/* Lines continuing to the row below (bottom half) */}
      {g.bottomLines.map(([col, ci], i) => (
        <line key={`b${i}`}
          x1={laneX(col)} y1={cy} x2={laneX(col)} y2={height}
          stroke={LANE_COLORS[ci % LANE_COLORS.length]}
          strokeWidth={STROKE_W} strokeLinecap="round" />
      ))}

      {/* Bezier edges: merge convergences and fork divergences */}
      {g.edges.map(([fromCol, toCol, ci], i) => (
        <path key={`e${i}`}
          d={edgePath(laneX(fromCol), laneX(toCol), cy, height)}
          stroke={LANE_COLORS[ci % LANE_COLORS.length]}
          strokeWidth={STROKE_W} fill="none" strokeLinecap="round" />
      ))}

      {/* Commit node */}
      <circle cx={cx} cy={cy} r={CIRCLE_R} fill={nodeColor} />
      <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill="#0d1117" />
      <circle cx={cx} cy={cy} r={CIRCLE_R - 1.5} fill={nodeColor} opacity={0.5} />

      {/* HEAD ring */}
      {g.isHead && (
        <circle cx={cx} cy={cy} r={CIRCLE_R + 2}
          fill="none" stroke={nodeColor} strokeWidth={1.5} opacity={0.8} />
      )}

      {/* Merge commit outer ring */}
      {g.isMerge && !g.isHead && (
        <circle cx={cx} cy={cy} r={CIRCLE_R + 1.5}
          fill="none" stroke={nodeColor} strokeWidth={1} opacity={0.5} />
      )}
    </svg>
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

const GraphRow = memo(function GraphRow({
  row,
  selected,
  dimmed,
  maxTotal,
  onClick,
  onContextMenu,
}: {
  row: RowData;
  selected: boolean;
  dimmed: boolean;
  maxTotal: number;
  onClick: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  const refs = row.commit.refs.slice(0, 4);
  const hasExtraRefs = row.commit.refs.length > refs.length;
  const ins = row.commit.insertions ?? 0;
  const del = row.commit.deletions ?? 0;

  return (
    <button
      type="button"
      draggable={false}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`flex w-full select-none items-center border-t border-pilot-line/60 text-left transition-colors hover:bg-[#21262d]/60 ${selected ? 'bg-teal-900/70 text-white hover:bg-teal-900/70' : 'text-slate-300'} ${dimmed ? 'opacity-35' : ''}`}
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
              <span className={`rounded px-1 py-0 text-[9px] leading-4 ${selected ? 'bg-white/15 text-white' : 'bg-[#21262d] text-slate-400'}`}>
                +{row.commit.refs.length - refs.length}
              </span>
            )}
          </div>
        )}
        <div className={`truncate text-xs ${selected ? 'font-medium text-white' : 'text-slate-200'}`}>
          {row.commit.message}
        </div>
      </div>

      {/* Changes column */}
      <div className="shrink-0 overflow-hidden" style={{ width: CHANGES_W }}>
        <ChangesBar ins={ins} del={del} maxTotal={maxTotal} />
      </div>

      {/* Author column */}
      <div
        className={`shrink-0 overflow-hidden px-2 text-[11px] ${selected ? 'text-white' : 'text-slate-400'}`}
        style={{ width: AUTHOR_W }}
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

      {/* Date column */}
      <div
        className={`shrink-0 px-2 text-[10px] ${selected ? 'text-slate-200' : 'text-slate-500'}`}
        style={{ width: DATE_W }}
      >
        {relativeDate(row.commit.date)}
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

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>(historyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dimMerges, setDimMerges] = useState(false);
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

  const rows = useMemo((): RowData[] => {
    const graphMap = new Map(graphData.map(r => [r.sha, r]));
    return history.map(commit => ({
      commit,
      graph: graphMap.get(commit.hash) ?? null,
    }));
  }, [history, graphData]);
  const authors = useMemo(() => Array.from(new Set(history.map(c => c.author))).sort(), [history]);
  const refs = useMemo(() => Array.from(new Set(history.flatMap(c => c.refs.map(cleanRef)))).sort(), [history]);
  const visibleRows = useMemo(() => rows.filter(row => matchesCommit(row.commit, search)), [rows, search]);
  const hasFilter = Boolean(search || filters.branch || filters.author || filters.since || filters.until || filters.keyword || filters.filePath);

  const maxTotal = useMemo(() =>
    Math.max(1, ...history.map(c => (c.insertions ?? 0) + (c.deletions ?? 0))),
    [history]
  );

  // Virtual scroll
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(visibleRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + OVERSCAN);
  const renderedRows = visibleRows.slice(startIndex, endIndex);
  const wdRowH = changedCount > 0 ? ROW_H : 0;
  const totalListHeight = visibleRows.length * ROW_H + LOAD_MORE_H;

  const handleFetch = async () => {
    setFetching(true);
    try { await fetchAll(); } finally { setFetching(false); }
  };

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
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">History</span>
            <span className="rounded bg-[#21262d] px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
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

            {/* Author filter */}
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

            {/* Fetch button */}
            <button
              className={`icon-btn h-7 gap-1 text-[10px] ${fetching ? 'opacity-60' : ''}`}
              onClick={() => void handleFetch()}
              disabled={fetching || !repo}
              title="Fetch all remotes"
            >
              <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
              <span className="hidden lg:inline">Fetch</span>
            </button>

            {/* Dim merges toggle */}
            <button
              className={`icon-btn h-7 gap-1 text-[10px] ${dimMerges ? 'accent' : ''}`}
              onClick={() => setDimMerges(v => !v)}
              title={dimMerges ? 'Show merge commits' : 'Dim merge commits'}
            >
              <EyeOff size={12} />
              <span className="hidden lg:inline">Merges</span>
            </button>

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
      <div className="flex shrink-0 select-none border-b border-pilot-line bg-pilot-bg text-[9px] font-bold uppercase tracking-wider text-slate-600">
        <div className="shrink-0" style={{ width: GRAPH_COL_W }} />
        <div className="min-w-0 flex-1 px-2 py-1.5">Commit Message</div>
        <div className="shrink-0 px-2 py-1.5" style={{ width: CHANGES_W }}>Changes</div>
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
        {/* Working Directory row — GitKraken WIP style */}
        {changedCount > 0 && (
          <button
            type="button"
            className="flex w-full select-none items-center border-b border-pilot-line/60 text-left transition-colors hover:bg-[#21262d]/60"
            style={{ height: wdRowH, background: 'linear-gradient(90deg, #1c2128 0%, #0d1117 100%)' }}
            onClick={() => useGitStore.setState({ rightPanelTab: 'working' })}
          >
            {/* WIP dot — white diamond-ish */}
            <div className="shrink-0 overflow-hidden" style={{ width: GRAPH_COL_W }}>
              <svg width={GRAPH_W} height={wdRowH} className="block overflow-hidden">
                <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R + 3} fill="#ffffff" opacity={0.08} />
                <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R} fill="#e2e8f0" />
                <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R - 1.5} fill="#0d1117" />
                <circle cx={PAD_LEFT} cy={wdRowH / 2} r={CIRCLE_R - 1.5} fill="#e2e8f0" opacity={0.4} />
              </svg>
            </div>

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
            <div className="shrink-0" style={{ width: CHANGES_W }} />

            {/* Author: no avatar for WIP */}
            <div className="shrink-0 px-2 text-[11px] text-slate-600" style={{ width: AUTHOR_W }}>
              working tree
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
