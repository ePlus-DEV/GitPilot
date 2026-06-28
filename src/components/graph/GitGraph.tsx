import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, GitCommitHorizontal, Search, X } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import type { CommitInfo, HistoryFilters } from '../../types/git';

const LANE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#60a5fa', '#4ade80', '#e879f9', '#f87171'];
const ROW_H = 34;
const LANE_W = 18;
const CIRCLE_R = 4;
const PAD_LEFT = 10;
const OVERSCAN = 8;
const MAX_VISIBLE_LANES = 10;
const GRAPH_W = MAX_VISIBLE_LANES * LANE_W + PAD_LEFT * 2;
const LOAD_MORE_H = 58;

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
}: {
  row: RowData;
  selected: boolean;
  onClick: () => void;
}) {
  const cy = ROW_H / 2;
  const laneOffset = Math.max(0, Math.min(row.lane - Math.floor(MAX_VISIBLE_LANES / 2), row.maxLane - MAX_VISIBLE_LANES + 1));
  const laneVisible = (lane: number) => lane >= laneOffset && lane < laneOffset + MAX_VISIBLE_LANES;
  const xForLane = (lane: number) => PAD_LEFT + (lane - laneOffset) * LANE_W;
  const cx = xForLane(row.lane);
  const visibleLines = row.lines.filter(ln => laneVisible(ln.fromLane) || laneVisible(ln.toLane));

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center border-t border-pilot-line text-left transition-colors hover:bg-slate-800/60 ${selected ? 'bg-slate-800 ring-1 ring-inset ring-sky-500/40' : ''}`}
      style={{ height: ROW_H }}
    >
      <div className="w-[200px] shrink-0 overflow-hidden">
        <svg width={GRAPH_W} height={ROW_H} className="block overflow-hidden">
          {visibleLines.map((ln, i) => {
            const x1 = Math.max(0, Math.min(GRAPH_W, xForLane(ln.fromLane)));
            const x2 = Math.max(0, Math.min(GRAPH_W, xForLane(ln.toLane)));
            const y1 = ln.pos === 'bottom' ? cy : 0;
            const y2 = ln.pos === 'top' ? cy : ROW_H;
            return x1 === x2
              ? <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ln.color} strokeWidth={1.6} />
              : <path key={i} d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`} fill="none" stroke={ln.color} strokeWidth={1.6} />;
          })}
          <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill={row.color} opacity={0.18} />
          <circle cx={cx} cy={cy} r={CIRCLE_R} fill={row.color} />
          {row.commit.head && <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill="none" stroke={row.color} strokeWidth={1.5} />}
        </svg>
      </div>

      <div className="min-w-0 flex flex-1 items-center gap-3 pr-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {row.commit.refs.slice(0, 5).map(ref => (
              <span key={ref} className="shrink-0 rounded border border-sky-400/30 bg-sky-400/10 px-1 py-0 text-[9px] font-semibold text-sky-300">
                {ref.replace('HEAD -> ', '').replace('tag: ', '')}
              </span>
            ))}
            <span className="truncate text-xs text-slate-200">{row.commit.message}</span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-slate-500">
            {row.commit.shortHash} - {row.commit.author} - {row.commit.date}
          </div>
        </div>
        {row.commit.parents.length > 1 && <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">merge</span>}
      </div>
    </button>
  );
});

export function GitGraph() {
  const history = useGitStore(s => s.history);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const selectCommit = useGitStore(s => s.selectCommit);
  const historyLimit = useGitStore(s => s.historyLimit);
  const historyFilters = useGitStore(s => s.historyFilters);
  const loadHistory = useGitStore(s => s.loadHistory);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>(historyFilters);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
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
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <GitCommitHorizontal size={13} /> Commit Graph - {visibleRows.length}/{history.length}
          </div>
          {hasFilter && <button className="icon-btn h-6" onClick={clear}><X size={12} /> Clear</button>}
        </div>

        <div className="grid grid-cols-[1.2fr_140px_140px_110px_110px] gap-2">
          <label className="relative">
            <Search size={13} className="pointer-events-none absolute left-2 top-1.5 text-slate-500" />
            <input className="input h-7 w-full pl-7 text-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hash, message, author..." />
          </label>
          <label className="relative">
            <Filter size={12} className="pointer-events-none absolute left-2 top-2 text-slate-500" />
            <select className="input h-7 w-full pl-7 text-xs" value={filters.author ?? ''} onChange={e => setFilters(f => ({ ...f, author: e.target.value || undefined }))}>
              <option value="">All authors</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <select className="input h-7 w-full text-xs" value={filters.branch ?? ''} onChange={e => setFilters(f => ({ ...f, branch: e.target.value || undefined }))}>
            <option value="">All refs</option>
            {refs.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="input h-7 text-xs" type="date" value={filters.since ?? ''} onChange={e => setFilters(f => ({ ...f, since: e.target.value || undefined }))} title="Since" />
          <input className="input h-7 text-xs" type="date" value={filters.until ?? ''} onChange={e => setFilters(f => ({ ...f, until: e.target.value || undefined }))} title="Until" />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className="input h-7 text-xs" value={filters.keyword ?? ''} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value || undefined }))} placeholder="Commit message keyword (git --grep)" />
          <input className="input h-7 text-xs" value={filters.filePath ?? ''} onChange={e => setFilters(f => ({ ...f, filePath: e.target.value || undefined }))} placeholder="File path filter (e.g. src/App.tsx)" />
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-auto [overflow-anchor:none]" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        <div className="relative" style={{ height: totalListHeight }}>
          {renderedRows.map((row, i) => {
            const index = startIndex + i;
            return (
              <div key={row.commit.hash} className="absolute left-0 right-0" style={{ top: index * ROW_H, height: ROW_H }}>
                <GraphRow
                  row={row}
                  selected={selectedCommit?.hash === row.commit.hash}
                  onClick={() => void selectCommit(row.commit)}
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
    </div>
  );
}
