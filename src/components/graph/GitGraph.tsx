import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Filter, GitCommitHorizontal, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { CommitInfo, HistoryFilters } from '../../types/git';

const LANE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#4ade80', '#e879f9', '#f87171'];
const ROW_H = 32;
const GRAPH_CHAR_W = 7;
const CIRCLE_R = 4;
const PAD_LEFT = 8;
const OVERSCAN = 8;
const MAX_GRAPH_CHARS = 28;
const GRAPH_W = MAX_GRAPH_CHARS * GRAPH_CHAR_W + PAD_LEFT * 2;
const REFS_W = 210;
const LOAD_MORE_H = 58;
const HISTORY_GRID = 'grid-cols-[minmax(480px,1fr)_220px]';

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
  const cy = ROW_H / 2;
  const xForCol = (col: number) => PAD_LEFT + col * GRAPH_CHAR_W;
  const cx = xForCol(row.nodeCol);
  const refs = row.commit.refs.slice(0, 3);
  const hasExtraRefs = row.commit.refs.length > refs.length;

  return (
    <button
      type="button"
      draggable={false}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`grid w-full select-none ${HISTORY_GRID} items-center border-t border-pilot-line/80 text-left transition-colors hover:bg-slate-800/50 ${selected ? 'bg-sky-700/95 text-white hover:bg-sky-700/95' : 'text-slate-300'}`}
      style={{ height: ROW_H }}
    >
      <div className="flex min-w-0 items-center">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 px-2" style={{ width: REFS_W }}>
          {refs.map(ref => (
            <span key={ref} className={`min-w-0 truncate rounded px-1.5 py-0 text-[10px] font-semibold leading-5 ${refClassName(ref, selected)}`}>
              {cleanRef(ref)}
            </span>
          ))}
          {hasExtraRefs && <span className={`rounded px-1 py-0 text-[10px] leading-5 ${selected ? 'bg-white/15 text-white' : 'bg-slate-700 text-slate-300'}`}>+{row.commit.refs.length - refs.length}</span>}
        </div>

        <div className="shrink-0 overflow-hidden px-2" style={{ width: GRAPH_W + 16 }}>
          <svg width={GRAPH_W} height={ROW_H} className="block overflow-hidden">
            {row.commit.parents.length > 0 && <line x1={cx} y1={cy} x2={cx} y2={ROW_H} stroke={row.color} strokeWidth={2} />}
            {row.commit.graph.includes('|') && <line x1={cx} y1={0} x2={cx} y2={cy} stroke={row.color} strokeWidth={2} />}
            {row.segments.map((segment, i) => {
              const x = xForCol(segment.col);
              if (segment.kind === 'vertical') {
                return <line key={i} x1={x} y1={0} x2={x} y2={ROW_H} stroke={segment.color} strokeWidth={2} />;
              }
              if (segment.kind === 'slash') {
                return <line key={i} x1={x + GRAPH_CHAR_W} y1={0} x2={x} y2={ROW_H} stroke={segment.color} strokeWidth={2} />;
              }
              if (segment.kind === 'backslash') {
                return <line key={i} x1={x} y1={0} x2={x + GRAPH_CHAR_W} y2={ROW_H} stroke={segment.color} strokeWidth={2} />;
              }
              return <line key={i} x1={x} y1={cy} x2={x + GRAPH_CHAR_W} y2={cy} stroke={segment.color} strokeWidth={2} />;
            })}
            <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill={row.color} opacity={0.16} />
            <circle cx={cx} cy={cy} r={CIRCLE_R} fill={row.color} />
            {row.commit.head && <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill="none" stroke={row.color} strokeWidth={1.5} />}
          </svg>
        </div>

        <div className={`min-w-0 flex-1 truncate pr-3 text-sm ${selected ? 'font-medium text-white' : 'font-normal text-slate-200'}`}>
          {row.commit.message}
        </div>
      </div>

      <div className={`flex min-w-0 items-center gap-2 border-l border-pilot-line/80 px-3 text-xs ${selected ? 'text-white' : 'text-slate-400'}`}>
        <span className={`h-5 w-5 shrink-0 rounded text-center text-[10px] font-semibold leading-5 ${selected ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
          {row.commit.author.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate">{row.commit.author}</span>
        <span className={`font-mono ${selected ? 'text-white' : 'text-slate-500'}`}>{row.commit.shortHash}</span>
        <span className="hidden truncate text-slate-500 xl:block">{row.commit.date}</span>
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

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (JSON.stringify(filters) === JSON.stringify(historyFilters)) return;
    const id = window.setTimeout(() => { void loadHistory(filters, historyLimit); }, 350);
    return () => window.clearTimeout(id);
  }, [filters, historyFilters, historyLimit, loadHistory]);

  const rows = useMemo(() => buildRows(history), [history]);
  const authors = useMemo(() => Array.from(new Set(history.map(c => c.author))).sort(), [history]);
  const refs = useMemo(() => Array.from(new Set(history.flatMap(c => c.refs.map(cleanRef)))).sort(), [history]);
  const visibleRows = useMemo(() => rows.filter(row => matchesCommit(row.commit, search)), [rows, search]);
  const hasFilter = Boolean(search || filters.branch || filters.author || filters.since || filters.until || filters.keyword || filters.filePath);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(visibleRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + OVERSCAN);
  const renderedRows = visibleRows.slice(startIndex, endIndex);
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
          if (confirm(`Checkout ${short} in detached HEAD?`)) runCommitAction('checkout commit', commit, rev => gitService.checkoutCommit(repo!, rev));
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
          if (confirm(`Rebase ${currentBranch} onto ${short}?`)) runCommitAction('rebase', commit, rev => gitService.startRebase(repo!, rev));
        },
      },
      {
        label: `Reset ${currentBranch} to this commit: soft`,
        action: () => {
          if (confirm(`Soft reset ${currentBranch} to ${short}?`)) runCommitAction('soft reset', commit, rev => gitService.resetToCommit(repo!, rev, 'soft'));
        },
      },
      {
        label: `Reset ${currentBranch} to this commit: mixed`,
        action: () => {
          if (confirm(`Mixed reset ${currentBranch} to ${short}?`)) runCommitAction('mixed reset', commit, rev => gitService.resetToCommit(repo!, rev, 'mixed'));
        },
      },
      {
        label: `Reset ${currentBranch} to this commit: hard`,
        danger: true,
        action: () => {
          if (confirm(`Hard reset ${currentBranch} to ${short}? This can discard work.`)) runCommitAction('hard reset', commit, rev => gitService.resetToCommit(repo!, rev, 'hard'));
        },
      },
      {
        label: 'Revert commit',
        danger: true,
        action: () => {
          if (confirm(`Revert ${short}?`)) runCommitAction('revert commit', commit, rev => gitService.revertCommit(repo!, rev));
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
          if (message) runCommitAction('annotated tag commit', commit, rev => gitService.createAnnotatedTagFromCommit(repo!, name, message, rev));
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
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Open a repository to see commit history</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#090e1b]">
      <div className="sticky top-0 z-10 border-b border-pilot-line bg-[#0d1324] p-2">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <GitCommitHorizontal size={13} /> {visibleRows.length}/{history.length}
          </div>
          <label className="relative min-w-[220px] flex-1">
            <Search size={13} className="pointer-events-none absolute left-2 top-1.5 text-slate-500" />
            <input className="input h-7 w-full pl-7 text-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search commit, SHA, author..." />
          </label>
          <label className="relative hidden w-40 xl:block">
            <Filter size={12} className="pointer-events-none absolute left-2 top-2 text-slate-500" />
            <select className="input h-7 w-full pl-7 text-xs" value={filters.author ?? ''} onChange={e => setFilters(f => ({ ...f, author: e.target.value || undefined }))}>
              <option value="">All authors</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <select className="input hidden h-7 w-40 text-xs xl:block" value={filters.branch ?? ''} onChange={e => setFilters(f => ({ ...f, branch: e.target.value || undefined }))}>
            <option value="">All refs</option>
            {refs.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className={`icon-btn h-7 ${filtersOpen ? 'accent' : ''}`} onClick={() => setFiltersOpen(v => !v)} title="Advanced filters">
            <SlidersHorizontal size={13} />
            <span>Filters</span>
          </button>
          {hasFilter && <button className="icon-btn h-7" onClick={clear}><X size={12} /> Clear</button>}
        </div>

        {filtersOpen && (
          <div className="mt-2 grid grid-cols-[minmax(130px,160px)_minmax(130px,160px)_1fr_1fr] gap-2">
            <input className="input h-7 text-xs" type="date" value={filters.since ?? ''} onChange={e => setFilters(f => ({ ...f, since: e.target.value || undefined }))} title="Since" />
            <input className="input h-7 text-xs" type="date" value={filters.until ?? ''} onChange={e => setFilters(f => ({ ...f, until: e.target.value || undefined }))} title="Until" />
            <input className="input h-7 text-xs" value={filters.keyword ?? ''} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value || undefined }))} placeholder="Commit message keyword (git --grep)" />
            <input className="input h-7 text-xs" value={filters.filePath ?? ''} onChange={e => setFilters(f => ({ ...f, filePath: e.target.value || undefined }))} placeholder="File path filter (e.g. src/App.tsx)" />
          </div>
        )}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 select-none overflow-auto [overflow-anchor:none]" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        <div className={`sticky top-0 z-10 grid select-none ${HISTORY_GRID} border-b border-pilot-line bg-[#151b24] text-[10px] font-bold uppercase tracking-wide text-slate-500`}>
          <div className="flex min-w-0 items-center">
            <div className="px-2 py-2" style={{ width: REFS_W }}>Branch / Tag</div>
            <div className="px-2 py-2" style={{ width: GRAPH_W + 16 }}>Graph</div>
            <div className="min-w-0 flex-1 px-3 py-2">Commit Message</div>
          </div>
          <div className="border-l border-pilot-line px-3 py-2">Details</div>
        </div>
        <div className="relative" style={{ height: totalListHeight }}>
          {renderedRows.map((row, i) => {
            const index = startIndex + i;
            const selected = Boolean(selectedCommit?.hash && selectedCommit.hash === commitRevision(row.commit));
            return (
              <div key={`${row.commit.hash || row.commit.shortHash}-${index}`} className="absolute left-0 right-0" style={{ top: index * ROW_H, height: ROW_H }}>
                <GraphRow
                  row={row}
                  selected={selected}
                  onClick={() => void selectCommit(row.commit)}
                  onContextMenu={event => {
                    event.preventDefault();
                    void selectCommit(row.commit);
                    setMenu({ x: event.clientX, y: event.clientY, commit: row.commit });
                  }}
                />
              </div>
            );
          })}
          {visibleRows.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No commits match the current filters.</div>}
          <div className="absolute left-0 right-0 border-t border-pilot-line p-3 text-center" style={{ top: visibleRows.length * ROW_H, height: LOAD_MORE_H }}>
            <button className="btn" onClick={() => void loadHistory(filters, historyLimit + 500)}>Load 500 more commits</button>
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
