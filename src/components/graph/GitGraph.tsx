import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Filter, GitCommitHorizontal, Search, SlidersHorizontal, X } from 'lucide-react';
import { ContextMenu } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { CommitInfo, HistoryFilters } from '../../types/git';

const LANE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#4ade80', '#e879f9', '#f87171'];
const ROW_H = 36;
const LANE_W = 13;
const CIRCLE_R = 4;
const PAD_LEFT = 8;
const OVERSCAN = 8;
const MAX_VISIBLE_LANES = 4;
const GRAPH_W = MAX_VISIBLE_LANES * LANE_W + PAD_LEFT * 2;
const LOAD_MORE_H = 58;
const HISTORY_GRID = 'grid-cols-[minmax(360px,1fr)_170px_110px_140px]';

type RowData = {
  commit: CommitInfo;
  lane: number;
  color: string;
  lines: Array<{ fromLane: number; toLane: number; color: string; pos: 'top' | 'bottom' }>;
  maxLane: number;
};

function buildRows(commits: CommitInfo[]): RowData[] {
  const lanes: Array<{ hash: string; colorIdx: number } | null> = [];
  const colorCounter = { n: 0 };
  const nextColor = () => colorCounter.n++ % LANE_COLORS.length;
  const findLane = (hash: string) => lanes.findIndex(l => l?.hash === hash);
  const freeLane = () => {
    const idx = lanes.findIndex(l => l === null);
    return idx === -1 ? lanes.length : idx;
  };
  const rows: RowData[] = [];

  for (const commit of commits) {
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
    for (let i = 0; i < lanes.length; i++) {
      if (i !== myLane && lanes[i]) lines.push({ fromLane: i, toLane: i, color: LANE_COLORS[lanes[i]!.colorIdx], pos: 'top' });
    }

    const parents = commit.parents ?? [];
    lanes[myLane] = null;
    if (parents[0]) {
      const existingLane = findLane(parents[0]);
      if (existingLane === -1) lanes[myLane] = { hash: parents[0], colorIdx: myColorIdx };
      else lines.push({ fromLane: myLane, toLane: existingLane, color: myColor, pos: 'bottom' });
    }
    for (let i = 1; i < parents.length; i++) {
      const parent = parents[i];
      const existingLane = findLane(parent);
      if (existingLane === -1) {
        const newLane = freeLane();
        const newColorIdx = nextColor();
        if (newLane === lanes.length) lanes.push(null);
        lanes[newLane] = { hash: parent, colorIdx: newColorIdx };
        lines.push({ fromLane: myLane, toLane: newLane, color: LANE_COLORS[newColorIdx], pos: 'bottom' });
      } else {
        lines.push({ fromLane: myLane, toLane: existingLane, color: LANE_COLORS[lanes[existingLane]!.colorIdx], pos: 'bottom' });
      }
    }
    for (let i = 0; i < lanes.length; i++) {
      if (i !== myLane && lanes[i]) lines.push({ fromLane: i, toLane: i, color: LANE_COLORS[lanes[i]!.colorIdx], pos: 'bottom' });
    }

    rows.push({ commit, lane: myLane, color: myColor, lines, maxLane: Math.max(myLane, ...lanes.map((l, i) => l ? i : 0)) });
  }
  return rows;
}

const normalized = (value: string) => value.toLowerCase().trim();

function matchesCommit(commit: CommitInfo, query: string) {
  const q = normalized(query);
  if (!q) return true;
  const refNames = commit.refs.join(' ');
  return [commit.message, commit.hash, commit.shortHash, commit.author, refNames].some(v => normalized(v).includes(q));
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
  const laneOffset = Math.max(0, Math.min(row.lane - Math.floor(MAX_VISIBLE_LANES / 2), row.maxLane - MAX_VISIBLE_LANES + 1));
  const laneVisible = (lane: number) => lane >= laneOffset && lane < laneOffset + MAX_VISIBLE_LANES;
  const xForLane = (lane: number) => PAD_LEFT + (lane - laneOffset) * LANE_W;
  const cx = xForLane(row.lane);
  const visibleLines = row.lines.filter(ln => laneVisible(ln.fromLane) || laneVisible(ln.toLane));

  return (
    <button
      type="button"
      draggable={false}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`grid w-full select-none ${HISTORY_GRID} items-center border-t border-pilot-line text-left transition-colors hover:bg-slate-800/60 ${selected ? 'bg-sky-600 text-white hover:bg-sky-600' : 'text-slate-200'}`}
      style={{ height: ROW_H }}
    >
      <div className="flex min-w-0 items-center">
        <div className="w-16 shrink-0 overflow-hidden">
          <svg width={GRAPH_W} height={ROW_H} className="block overflow-hidden">
            {visibleLines.map((ln, i) => {
              const x1 = Math.max(0, Math.min(GRAPH_W, xForLane(ln.fromLane)));
              const x2 = Math.max(0, Math.min(GRAPH_W, xForLane(ln.toLane)));
              const y1 = ln.pos === 'bottom' ? cy : 0;
              const y2 = ln.pos === 'top' ? cy : ROW_H;
              return x1 === x2
                ? <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ln.color} strokeWidth={1.8} />
                : <path key={i} d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`} fill="none" stroke={ln.color} strokeWidth={1.8} />;
            })}
            <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill={row.color} opacity={0.16} />
            <circle cx={cx} cy={cy} r={CIRCLE_R} fill={row.color} />
            {row.commit.head && <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill="none" stroke={row.color} strokeWidth={1.5} />}
          </svg>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-3">
          {row.commit.refs.slice(0, 3).map(ref => (
            <span key={ref} className={`shrink-0 rounded px-1.5 py-0 text-[10px] font-semibold ${selected ? 'bg-white/20 text-white' : ref.includes('origin') ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {ref.replace('HEAD -> ', '').replace('tag: ', '')}
            </span>
          ))}
          <span className={`truncate text-sm ${selected ? 'text-white' : 'text-slate-100'}`}>{row.commit.message}</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 px-3">
        <span className={`h-5 w-5 shrink-0 rounded bg-slate-700 text-center text-[10px] font-semibold leading-5 ${selected ? 'text-white' : 'text-slate-300'}`}>
          {row.commit.author.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate text-sm">{row.commit.author}</span>
      </div>
      <div className="truncate px-3 font-mono text-sm">{row.commit.shortHash}</div>
      <div className="truncate px-3 text-sm">{row.commit.date}</div>
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
  const loadHistory = useGitStore(s => s.loadHistory);
  const run = useGitStore(s => s.run);
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
  const refs = useMemo(() => Array.from(new Set(history.flatMap(c => c.refs.map(r => r.replace('HEAD -> ', '').replace('tag: ', ''))))).sort(), [history]);
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
        <div className={`sticky top-0 z-10 grid select-none ${HISTORY_GRID} border-b border-pilot-line bg-[#20262a] text-[11px] font-bold uppercase tracking-wide text-slate-400`}>
          <div className="px-16 py-2">Graph & Subject</div>
          <div className="border-l border-pilot-line px-3 py-2">Author</div>
          <div className="border-l border-pilot-line px-3 py-2">SHA</div>
          <div className="border-l border-pilot-line px-3 py-2">Commit Time</div>
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
          items={[
            {
              label: 'Create branch here',
              action: () => {
                const name = ask('New branch name', `branch-${menu.commit.shortHash}`);
                if (name) runCommitAction('branch from commit', menu.commit, revision => gitService.createBranchFromCommit(repo!, name, revision, true));
              },
            },
            {
              label: 'Create tag here',
              action: () => {
                const name = ask('New tag name', `tag-${menu.commit.shortHash}`);
                if (name) runCommitAction('tag commit', menu.commit, revision => gitService.createTagFromCommit(repo!, name, revision));
              },
            },
            {
              label: 'Cherry-pick commit',
              action: () => runCommitAction('cherry-pick', menu.commit, revision => gitService.cherryPickCommit(repo!, revision)),
            },
            {
              label: 'Revert commit',
              danger: true,
              action: () => {
                if (confirm(`Revert ${menu.commit.shortHash}?`)) runCommitAction('revert commit', menu.commit, revision => gitService.revertCommit(repo!, revision));
              },
            },
            {
              label: 'Checkout commit',
              action: () => {
                if (confirm(`Checkout ${menu.commit.shortHash} in detached HEAD?`)) runCommitAction('checkout commit', menu.commit, revision => gitService.checkoutCommit(repo!, revision));
              },
            },
            {
              label: 'Reset current branch: soft',
              action: () => {
                if (confirm(`Soft reset current branch to ${menu.commit.shortHash}?`)) runCommitAction('soft reset', menu.commit, revision => gitService.resetToCommit(repo!, revision, 'soft'));
              },
            },
            {
              label: 'Reset current branch: mixed',
              action: () => {
                if (confirm(`Mixed reset current branch to ${menu.commit.shortHash}?`)) runCommitAction('mixed reset', menu.commit, revision => gitService.resetToCommit(repo!, revision, 'mixed'));
              },
            },
            {
              label: 'Reset current branch: hard',
              danger: true,
              action: () => {
                if (confirm(`Hard reset current branch to ${menu.commit.shortHash}? This can discard work.`)) runCommitAction('hard reset', menu.commit, revision => gitService.resetToCommit(repo!, revision, 'hard'));
              },
            },
          ]}
        />
      )}
    </div>
  );
}
