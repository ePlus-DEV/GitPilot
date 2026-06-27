import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, GitCommitHorizontal, Search, X } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import type { CommitInfo, HistoryFilters } from '../../types/git';

const LANE_COLORS = ['#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#facc15','#60a5fa','#4ade80','#e879f9','#f87171'];
const ROW_H = 34;
const LANE_W = 18;
const CIRCLE_R = 4;
const PAD_LEFT = 10;

type RowData = { commit: CommitInfo; lane: number; color: string; lines: Array<{ fromLane: number; toLane: number; color: string; pos: 'top' | 'bottom' }>; maxLane: number };

function buildRows(commits: CommitInfo[]): RowData[] {
  const lanes: Array<{ hash: string; colorIdx: number } | null> = [];
  const colorCounter = { n: 0 };
  const nextColor = () => colorCounter.n++ % LANE_COLORS.length;
  const findLane = (hash: string) => lanes.findIndex(l => l?.hash === hash);
  const freeLane = () => { const idx = lanes.findIndex(l => l === null); return idx === -1 ? lanes.length : idx; };
  const rows: RowData[] = [];
  for (const commit of commits) {
    let myLane = findLane(commit.hash);
    let myColorIdx: number;
    if (myLane === -1) { myLane = freeLane(); myColorIdx = nextColor(); if (myLane === lanes.length) lanes.push(null); lanes[myLane] = { hash: commit.hash, colorIdx: myColorIdx }; }
    else myColorIdx = lanes[myLane]!.colorIdx;
    const myColor = LANE_COLORS[myColorIdx];
    const lines: RowData['lines'] = [];
    for (let i = 0; i < lanes.length; i++) if (i !== myLane && lanes[i]) lines.push({ fromLane: i, toLane: i, color: LANE_COLORS[lanes[i]!.colorIdx], pos: 'top' });
    const parents = commit.parents ?? [];
    lanes[myLane] = null;
    if (parents[0]) { const existingLane = findLane(parents[0]); if (existingLane === -1) lanes[myLane] = { hash: parents[0], colorIdx: myColorIdx }; else lines.push({ fromLane: myLane, toLane: existingLane, color: myColor, pos: 'bottom' }); }
    for (let i = 1; i < parents.length; i++) { const parent = parents[i]; const existingLane = findLane(parent); if (existingLane === -1) { const newLane = freeLane(); const newColorIdx = nextColor(); if (newLane === lanes.length) lanes.push(null); lanes[newLane] = { hash: parent, colorIdx: newColorIdx }; lines.push({ fromLane: myLane, toLane: newLane, color: LANE_COLORS[newColorIdx], pos: 'bottom' }); } else lines.push({ fromLane: myLane, toLane: existingLane, color: LANE_COLORS[lanes[existingLane]!.colorIdx], pos: 'bottom' }); }
    for (let i = 0; i < lanes.length; i++) if (i !== myLane && lanes[i]) lines.push({ fromLane: i, toLane: i, color: LANE_COLORS[lanes[i]!.colorIdx], pos: 'bottom' });
    rows.push({ commit, lane: myLane, color: myColor, lines, maxLane: Math.max(myLane, ...lanes.map((l, i) => l ? i : 0)) });
  }
  return rows;
}

const normalized = (value: string) => value.toLowerCase().trim();
function matchesCommit(commit: CommitInfo, query: string) {
  const q = normalized(query); if (!q) return true;
  const refNames = commit.refs.join(' ');
  return [commit.message, commit.hash, commit.shortHash, commit.author, refNames].some(v => normalized(v).includes(q));
}

function GraphRow({ row, selected, dimmed, onClick, rowRef }: { row: RowData; selected: boolean; dimmed: boolean; onClick: () => void; rowRef?: (node: HTMLButtonElement | null) => void }) {
  const svgWidth = (row.maxLane + 1) * LANE_W + PAD_LEFT * 2;
  const cy = ROW_H / 2; const cx = PAD_LEFT + row.lane * LANE_W;
  return <button ref={rowRef} onClick={onClick} className={`flex w-full items-center border-t border-pilot-line text-left transition-colors hover:bg-slate-800/60 ${selected ? 'bg-slate-800 ring-1 ring-inset ring-sky-500/40' : ''} ${dimmed ? 'opacity-35' : ''}`} style={{ height: ROW_H }}>
    <svg width={svgWidth} height={ROW_H} className="shrink-0 overflow-visible">
      {row.lines.map((ln, i) => { const x1 = PAD_LEFT + ln.fromLane * LANE_W; const x2 = PAD_LEFT + ln.toLane * LANE_W; const y1 = ln.pos === 'bottom' ? cy : 0; const y2 = ln.pos === 'top' ? cy : ROW_H; return x1 === x2 ? <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ln.color} strokeWidth={1.6} /> : <path key={i} d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`} fill="none" stroke={ln.color} strokeWidth={1.6} />; })}
      <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill={row.color} opacity={0.18} /><circle cx={cx} cy={cy} r={CIRCLE_R} fill={row.color} />{row.commit.head && <circle cx={cx} cy={cy} r={CIRCLE_R + 3} fill="none" stroke={row.color} strokeWidth={1.5} />}
    </svg>
    <div className="min-w-0 flex flex-1 items-center gap-3 pr-3"><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5">{row.commit.refs.slice(0, 5).map(ref => <span key={ref} className="shrink-0 rounded border border-sky-400/30 bg-sky-400/10 px-1 py-0 text-[9px] font-semibold text-sky-300">{ref.replace('HEAD -> ', '').replace('tag: ', '')}</span>)}<span className="truncate text-xs text-slate-200">{row.commit.message}</span></div><div className="mt-0.5 text-[10px] text-slate-500">{row.commit.shortHash} · {row.commit.author} · {row.commit.date}</div></div>{row.commit.parents.length > 1 && <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">merge</span>}</div>
  </button>;
}

export function GitGraph() {
  const { history, selectedCommit, selectCommit, historyLimit, historyFilters, loadHistory } = useGitStore(s => ({ history: s.history, selectedCommit: s.selectedCommit, selectCommit: s.selectCommit, historyLimit: s.historyLimit, historyFilters: s.historyFilters, loadHistory: s.loadHistory }));
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>(historyFilters);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { const id = window.setTimeout(() => { void loadHistory(filters, historyLimit); }, 350); return () => window.clearTimeout(id); }, [filters, historyLimit, loadHistory]);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [selectedCommit?.hash]);
  const rows = useMemo(() => buildRows(history), [history]);
  const authors = useMemo(() => Array.from(new Set(history.map(c => c.author))).sort(), [history]);
  const refs = useMemo(() => Array.from(new Set(history.flatMap(c => c.refs.map(r => r.replace('HEAD -> ', '').replace('tag: ', ''))))).sort(), [history]);
  const visibleRows = rows.filter(row => matchesCommit(row.commit, search));
  const hasFilter = Boolean(search || filters.branch || filters.author || filters.since || filters.until || filters.keyword || filters.filePath);
  const clear = () => { setSearch(''); setFilters({}); };
  if (history.length === 0) return <div className="flex h-full items-center justify-center text-sm text-slate-500">Open a repository to see commit history</div>;
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#090e1b]">
    <div className="sticky top-0 z-10 border-b border-pilot-line bg-[#0d1324] p-2">
      <div className="mb-2 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><GitCommitHorizontal size={13} /> Commit Graph · {visibleRows.length}/{history.length}</div>{hasFilter && <button className="icon-btn h-6" onClick={clear}><X size={12} /> Clear</button>}</div>
      <div className="grid grid-cols-[1.2fr_140px_140px_110px_110px] gap-2">
        <label className="relative"><Search size={13} className="pointer-events-none absolute left-2 top-1.5 text-slate-500" /><input className="input h-7 w-full pl-7 text-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hash, message, author…" /></label>
        <label className="relative"><Filter size={12} className="pointer-events-none absolute left-2 top-2 text-slate-500" /><select className="input h-7 w-full pl-7 text-xs" value={filters.author ?? ''} onChange={e => setFilters(f => ({ ...f, author: e.target.value || undefined }))}><option value="">All authors</option>{authors.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
        <select className="input h-7 w-full text-xs" value={filters.branch ?? ''} onChange={e => setFilters(f => ({ ...f, branch: e.target.value || undefined }))}><option value="">All refs</option>{refs.map(r => <option key={r} value={r}>{r}</option>)}</select>
        <input className="input h-7 text-xs" type="date" value={filters.since ?? ''} onChange={e => setFilters(f => ({ ...f, since: e.target.value || undefined }))} title="Since" />
        <input className="input h-7 text-xs" type="date" value={filters.until ?? ''} onChange={e => setFilters(f => ({ ...f, until: e.target.value || undefined }))} title="Until" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2"><input className="input h-7 text-xs" value={filters.keyword ?? ''} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value || undefined }))} placeholder="Commit message keyword (git --grep)" /><input className="input h-7 text-xs" value={filters.filePath ?? ''} onChange={e => setFilters(f => ({ ...f, filePath: e.target.value || undefined }))} placeholder="File path filter (e.g. src/App.tsx)" /></div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {visibleRows.map(row => <GraphRow key={row.commit.hash} row={row} selected={selectedCommit?.hash === row.commit.hash} dimmed={false} rowRef={selectedCommit?.hash === row.commit.hash ? node => { selectedRef.current = node; } : undefined} onClick={() => void selectCommit(row.commit)} />)}
      {visibleRows.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No commits match the current GitKraken-style filters.</div>}
      <div className="border-t border-pilot-line p-3 text-center"><button className="btn" onClick={() => void loadHistory(filters, historyLimit + 500)}>Load 500 more commits</button></div>
    </div>
  </div>;
}
