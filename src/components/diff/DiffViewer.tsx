import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Editor from '@monaco-editor/react';
import {
  ChevronDown, ChevronUp, Columns2, FileText, GitCompare, History, Loader2, Rows3, X,
} from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { CommitFile, CommitInfo, GitFileStatus } from '../../types/git';

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  rs: 'rust', py: 'python', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
  cs: 'csharp', rb: 'ruby', php: 'php', json: 'json', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', md: 'markdown', html: 'html', css: 'css', scss: 'scss', sql: 'sql',
  sh: 'shell', bash: 'shell', kt: 'kotlin', swift: 'swift', dart: 'dart',
};
function getLang(path: string) {
  return LANG_MAP[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';
}

// ─── Diff parsing ─────────────────────────────────────────────────────────────

type LineType = 'context' | 'add' | 'remove';

type HunkLine = {
  type: LineType;
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

type Hunk = {
  header: string;
  oldStart: number;
  newStart: number;
  lines: HunkLine[];
};

function parsePatch(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  let oldLine = 0, newLine = 0;
  for (const raw of patch.split('\n')) {
    const hm = raw.match(/^@@ -(\d+)(?:,\d*)? \+(\d+)(?:,\d*)? @@(.*)$/);
    if (hm) {
      if (current) hunks.push(current);
      oldLine = parseInt(hm[1]); newLine = parseInt(hm[2]);
      current = { header: raw, oldStart: oldLine, newStart: newLine, lines: [] };
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+++') || raw.startsWith('---')) continue;
    if (raw.startsWith('+')) {
      current.lines.push({ type: 'add', text: raw.slice(1), oldLine: null, newLine: newLine++ });
    } else if (raw.startsWith('-')) {
      current.lines.push({ type: 'remove', text: raw.slice(1), oldLine: oldLine++, newLine: null });
    } else {
      current.lines.push({ type: 'context', text: raw.slice(1), oldLine: oldLine++, newLine: newLine++ });
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

function buildHunkPatch(filePath: string, hunk: Hunk): string {
  const addCount = hunk.lines.filter(l => l.type !== 'remove').length;
  const removeCount = hunk.lines.filter(l => l.type !== 'add').length;
  const header = `@@ -${hunk.oldStart},${removeCount} +${hunk.newStart},${addCount} @@`;
  const body = hunk.lines.map(l => (l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' ') + l.text).join('\n');
  return `--- a/${filePath}\n+++ b/${filePath}\n${header}\n${body}\n`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  A: 'text-emerald-400', M: 'text-amber-400', D: 'text-red-400',
  R: 'text-blue-400',    C: 'text-purple-400', U: 'text-orange-400',
};

function statusColor(s: string) { return STATUS_COLOR[s.toUpperCase()] ?? 'text-slate-400'; }

// ─── Diff line rendering ──────────────────────────────────────────────────────

const LINE_BG: Record<LineType, string> = {
  add: 'bg-[#0d4428]', remove: 'bg-[#3d1212]', context: '',
};
const LINE_TEXT: Record<LineType, string> = {
  add: 'text-emerald-200', remove: 'text-red-300', context: 'text-slate-300',
};
const LINE_SYM: Record<LineType, string> = { add: '+', remove: '-', context: ' ' };

function DiffLine({ line }: { line: HunkLine }) {
  return (
    <div className={`flex min-w-0 leading-5 hover:brightness-110 ${LINE_BG[line.type]}`}>
      <span className="w-10 shrink-0 select-none border-r border-[#21262d] pr-1.5 text-right font-mono text-[10px] text-slate-600">
        {line.oldLine ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none border-r border-[#21262d] pr-1.5 text-right font-mono text-[10px] text-slate-600">
        {line.newLine ?? ''}
      </span>
      <span className={`w-4 shrink-0 select-none text-center font-mono text-[11px] ${
        line.type === 'add' ? 'text-emerald-500' : line.type === 'remove' ? 'text-red-500' : 'text-slate-600'
      }`}>
        {LINE_SYM[line.type]}
      </span>
      <span className={`min-w-0 flex-1 whitespace-pre-wrap break-all pr-2 font-mono text-[12px] ${LINE_TEXT[line.type]}`}>
        {line.text}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type ViewMode = 'diff' | 'file' | 'history';

export function DiffViewer() {
  const diff = useGitStore(s => s.diff);
  const run = useGitStore(s => s.run);
  const repo = useGitStore(s => s.repo?.path);
  const selectedCommit = useGitStore(s => s.selectedCommit);
  const commitFiles = useGitStore(s => s.commitFiles);
  const status = useGitStore(s => s.status);
  const setSelectedFile = useGitStore(s => s.setSelectedFile);
  const log = useGitStore(s => s.log);

  const [view, setView] = useState<ViewMode>('diff');
  const [layout, setLayout] = useState<'unified' | 'side'>('unified');
  const [hunkIdx, setHunkIdx] = useState(0);
  const PAGE = 40;
  const [fileHistory, setFileHistory] = useState<CommitInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyCommit, setHistoryCommit] = useState<CommitInfo | null>(null);
  const [historyContent, setHistoryContent] = useState<string | null>(null);
  const [historyContentLoading, setHistoryContentLoading] = useState(false);
  const hunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const historyLoadingRef = useRef(false);

  const hunks = useMemo(() => (diff?.patch ? parsePatch(diff.patch) : []), [diff?.patch]);

  useEffect(() => { setHunkIdx(0); setView('diff'); }, [diff?.filePath]);

  const loadHistoryPage = useCallback((skip: number, replace: boolean) => {
    if (!repo || !diff) return;
    historyLoadingRef.current = true;
    setHistoryLoading(skip === 0);
    gitService.getHistory(repo, PAGE, { filePath: diff.filePath }, skip)
      .then(page => {
        setFileHistory(prev => replace ? page : [...prev, ...page]);
        setHistoryHasMore(page.length === PAGE);
      })
      .catch(e => log(String((e as Error).message ?? e)))
      .finally(() => { setHistoryLoading(false); historyLoadingRef.current = false; });
  }, [repo, diff?.filePath]);

  useEffect(() => {
    if (view !== 'history') return;
    setFileHistory([]);
    setHistoryCommit(null);
    setHistoryContent(null);
    loadHistoryPage(0, true);
  }, [view, diff?.filePath]);

  // IntersectionObserver — load more when sentinel scrolls into view inside the list container
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = historyListRef.current;
    if (!sentinel || !root) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && historyHasMore && !historyLoadingRef.current) {
        loadHistoryPage(fileHistory.length, false);
      }
    }, { root, threshold: 0, rootMargin: '0px 0px 120px 0px' });
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [historyHasMore, fileHistory.length, loadHistoryPage]);

  const scrollToHunk = useCallback((idx: number) => {
    hunkRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const prevHunk = () => {
    const next = Math.max(0, hunkIdx - 1);
    setHunkIdx(next); scrollToHunk(next);
  };
  const nextHunk = () => {
    const next = Math.min(hunks.length - 1, hunkIdx + 1);
    setHunkIdx(next); scrollToHunk(next);
  };

  const revertHunk = async (hunk: Hunk) => {
    if (!repo || !diff) return;
    const patch = buildHunkPatch(diff.filePath, hunk);
    await run('revert hunk', () => invoke('revert_hunk', { repoPath: repo, patch, cached: diff.cached }));
  };

  // Open a commit file diff
  const openCommitFile = (file: CommitFile) => {
    if (!repo || !selectedCommit) return;
    const revision = selectedCommit.hash.trim() || selectedCommit.shortHash.trim();
    gitService.getCommitFileDiff(repo, revision, file.path)
      .then(d => useGitStore.setState({ diff: d }))
      .catch(e => log(String((e as Error).message ?? e)));
  };

  // Open a working dir file diff
  const openWorkingFile = (file: GitFileStatus, cached: boolean) => {
    void setSelectedFile(file, cached);
  };

  // Determine mode: commit review or working dir
  const isCommitMode = Boolean(selectedCommit && commitFiles.length > 0);

  // Working dir file lists
  const wdFiles = [
    ...status.staged.map(f => ({ file: f, cached: true })),
    ...status.unstaged.map(f => ({ file: f, cached: false })),
    ...status.untracked.map(f => ({ file: f, cached: false })),
  ];

  if (!diff) return null;

  const fileParts = diff.filePath.replace(/\\/g, '/').split('/');
  const canRevert = diff.cached !== undefined && !isCommitMode;

  // ── File list sidebar ──────────────────────────────────────────────────────
  const fileList = (
    <div className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-pilot-line bg-[#0d1117]">
      <div className="flex shrink-0 items-center gap-2 border-b border-pilot-line px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {isCommitMode ? `${commitFiles.length} changed files` : `${wdFiles.length} changed files`}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isCommitMode
          ? commitFiles.map(f => {
              const isActive = f.path === diff.filePath;
              const stat = f.status ?? 'M';
              return (
                <button
                  key={f.path}
                  onClick={() => openCommitFile(f)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    isActive ? 'bg-[#21262d] text-slate-100' : 'text-slate-400 hover:bg-[#161b22] hover:text-slate-200'
                  }`}
                >
                  <span className={`shrink-0 w-3 font-mono text-[10px] font-bold ${statusColor(stat)}`}>{stat}</span>
                  <span className="min-w-0 truncate">{f.path.split('/').pop()}</span>
                </button>
              );
            })
          : wdFiles.map(({ file, cached }) => {
              const isActive = file.path === diff.filePath && cached === diff.cached;
              const sym = cached ? 'S' : file.indexStatus || file.worktreeStatus || '?';
              return (
                <button
                  key={file.path + (cached ? '-c' : '-u')}
                  onClick={() => openWorkingFile(file, cached)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    isActive ? 'bg-[#21262d] text-slate-100' : 'text-slate-400 hover:bg-[#161b22] hover:text-slate-200'
                  }`}
                >
                  <span className={`shrink-0 w-3 font-mono text-[10px] font-bold ${cached ? 'text-emerald-400' : statusColor(sym)}`}>{sym}</span>
                  <span className="min-w-0 truncate">{file.path.split('/').pop()}</span>
                </button>
              );
            })
        }
      </div>
    </div>
  );

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex h-11 shrink-0 items-stretch border-b border-pilot-line bg-[#161b22]">
      {/* File path breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-1 px-3">
        <span className="truncate text-[11px] text-slate-500">
          {fileParts.slice(0, -1).join('/')}{fileParts.length > 1 ? '/' : ''}
        </span>
        <span className="shrink-0 text-xs font-semibold text-slate-200">
          {fileParts[fileParts.length - 1]}
        </span>
      </div>

      {/* View toggle */}
      <div className="flex shrink-0 items-stretch border-x border-pilot-line">
        <button
          onClick={() => setView('file')}
          className={`flex items-center gap-1.5 px-4 text-xs font-medium transition-colors ${
            view === 'file' ? 'border-b-2 border-pilot-blue bg-[#0d1117] text-pilot-blue' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText size={15} /> File View
        </button>
        <button
          onClick={() => setView('diff')}
          className={`flex items-center gap-1.5 px-4 text-xs font-medium transition-colors ${
            view === 'diff' ? 'border-b-2 border-pilot-blue bg-[#0d1117] text-pilot-blue' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCompare size={15} /> Diff View
        </button>
        <button
          onClick={() => {
            setView('history');
            if (diff) void useGitStore.getState().loadHistory({ filePath: diff.filePath });
          }}
          className={`flex items-center gap-1.5 px-4 text-xs font-medium transition-colors ${
            view === 'history' ? 'border-b-2 border-pilot-blue bg-[#0d1117] text-pilot-blue' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History size={15} /> History
        </button>
      </div>

      {/* Right controls */}
      <div className="flex shrink-0 items-center gap-0.5 px-2">
        <button
          className="icon-btn h-8 w-8 justify-center p-0"
          title="Previous change (↑)"
          disabled={hunks.length === 0 || hunkIdx === 0}
          onClick={prevHunk}
        >
          <ChevronUp size={15} />
        </button>
        <button
          className="icon-btn h-8 w-8 justify-center p-0"
          title="Next change (↓)"
          disabled={hunks.length === 0 || hunkIdx >= hunks.length - 1}
          onClick={nextHunk}
        >
          <ChevronDown size={15} />
        </button>
        {hunks.length > 0 && (
          <span className="min-w-[32px] text-center text-[10px] text-slate-500 select-none">
            {hunkIdx + 1}/{hunks.length}
          </span>
        )}

        <div className="mx-1 h-4 w-px bg-[#30363d]" />

        <button
          className={`icon-btn h-8 w-8 justify-center p-0 ${layout === 'unified' ? 'text-pilot-blue' : ''}`}
          title="Unified diff"
          onClick={() => setLayout('unified')}
        >
          <Rows3 size={15} />
        </button>
        <button
          className={`icon-btn h-8 w-8 justify-center p-0 ${layout === 'side' ? 'text-pilot-blue' : ''}`}
          title="Side-by-side diff"
          onClick={() => setLayout('side')}
        >
          <Columns2 size={15} />
        </button>

        <div className="mx-1 h-4 w-px bg-[#30363d]" />

        <button
          className="icon-btn h-8 w-8 justify-center p-0"
          title="Close diff"
          onClick={() => useGitStore.setState({ diff: undefined })}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );

  // ── Content ────────────────────────────────────────────────────────────────
  const content = (() => {
    if (diff.binary) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-amber-400">
          Binary file — cannot display: {diff.filePath}
        </div>
      );
    }

    if (view === 'history') {
      const commitList = (
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-pilot-line bg-[#0d1117]">
          <div className="flex shrink-0 items-center border-b border-pilot-line px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              File History
            </span>
          </div>
          {historyLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          ) : fileHistory.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              No history found.
            </div>
          ) : (
            <div ref={historyListRef} className="min-h-0 flex-1 overflow-auto">
              {fileHistory.map(c => (
                <button
                  key={c.hash}
                  className={`flex w-full flex-col gap-0.5 border-b border-[#21262d] px-3 py-2 text-left transition-colors hover:bg-[#161b22] ${
                    historyCommit?.hash === c.hash ? 'bg-[#21262d]' : ''
                  }`}
                  onClick={() => {
                    if (!repo || !diff) return;
                    setHistoryCommit(c);
                    setHistoryContent(null);
                    setHistoryContentLoading(true);
                    gitService.getCommitFileDiff(repo, c.hash.trim(), diff.filePath)
                      .then(d => setHistoryContent(d.newText || d.oldText || ''))
                      .catch(e => { log(String((e as Error).message ?? e)); setHistoryContent(''); })
                      .finally(() => setHistoryContentLoading(false));
                  }}
                >
                  <span className="font-mono text-[10px] text-blue-400">{c.shortHash}</span>
                  <span className="truncate text-[11px] text-slate-200">{c.message}</span>
                  <span className="text-[10px] text-slate-500">{c.author} · {c.date}</span>
                </button>
              ))}
              {/* sentinel for infinite scroll — invisible, just a trigger */}
              <div ref={sentinelRef} className="h-1" />
              {historyHasMore && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 size={12} className="animate-spin text-slate-600" />
                </div>
              )}
            </div>
          )}
        </div>
      );

      const filePreview = (
        <div className="min-h-0 flex-1 bg-[#0d1117]">
          {historyContentLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          ) : historyContent === null ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Select a commit to view file content.
            </div>
          ) : (
            <Editor
              height="100%"
              theme="vs-dark"
              language={getLang(diff.filePath)}
              value={historyContent}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: 'on',
                folding: false,
                wordWrap: 'off',
                renderWhitespace: 'none',
                scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
              }}
            />
          )}
        </div>
      );

      return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {commitList}
          {filePreview}
        </div>
      );
    }

    if (view === 'file') {
      return (
        <div className="min-h-0 flex-1 bg-[#0d1117]">
          <Editor
            height="100%"
            theme="vs-dark"
            language={getLang(diff.filePath)}
            value={diff.newText || diff.oldText || ''}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: 'on',
              folding: false,
              wordWrap: 'off',
              renderWhitespace: 'none',
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            }}
          />
        </div>
      );
    }

    if (hunks.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
          No changes
        </div>
      );
    }

    if (layout === 'side') {
      return <SideBySideView hunks={hunks} hunkRefs={hunkRefs} canRevert={canRevert} onRevert={revertHunk} scrollRef={scrollRef} />;
    }

    return (
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-[#0d1117]">
        {hunks.map((hunk, i) => (
          <div key={i} ref={el => { hunkRefs.current[i] = el; }}>
            {/* Hunk header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-y border-[#21262d] bg-[#1c2128] px-3 py-1">
              <span className="font-mono text-[11px] text-blue-400">{hunk.header}</span>
              {canRevert && (
                <button className="btn py-0.5 px-2 text-[10px]" onClick={() => void revertHunk(hunk)}>
                  Revert Hunk
                </button>
              )}
            </div>
            {hunk.lines.map((line, j) => (
              <DiffLine key={j} line={line} />
            ))}
          </div>
        ))}
      </div>
    );
  })();

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#0d1117]">
      {fileList}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {toolbar}
        {content}
      </div>
    </div>
  );
}

// ─── Side-by-side view ────────────────────────────────────────────────────────

function SideBySideView({
  hunks, hunkRefs, canRevert, onRevert, scrollRef,
}: {
  hunks: Hunk[];
  hunkRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  canRevert: boolean;
  onRevert: (h: Hunk) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-[#0d1117]">
      {hunks.map((hunk, i) => {
        const pairs: Array<{ left: HunkLine | null; right: HunkLine | null }> = [];
        const removes: HunkLine[] = [], adds: HunkLine[] = [];
        for (const line of hunk.lines) {
          if (line.type === 'remove') removes.push(line);
          else if (line.type === 'add') adds.push(line);
          else {
            while (removes.length || adds.length)
              pairs.push({ left: removes.shift() ?? null, right: adds.shift() ?? null });
            pairs.push({ left: line, right: line });
          }
        }
        while (removes.length || adds.length)
          pairs.push({ left: removes.shift() ?? null, right: adds.shift() ?? null });

        return (
          <div key={i} ref={el => { hunkRefs.current[i] = el; }}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-y border-[#21262d] bg-[#1c2128] px-3 py-1">
              <span className="font-mono text-[11px] text-blue-400">{hunk.header}</span>
              {canRevert && (
                <button className="btn py-0.5 px-2 text-[10px]" onClick={() => onRevert(hunk)}>
                  Revert Hunk
                </button>
              )}
            </div>
            {pairs.map((pair, j) => (
              <div key={j} className="flex min-w-0">
                <div className={`flex min-w-0 flex-1 border-r border-[#21262d] leading-5 ${pair.left?.type === 'remove' ? 'bg-[#3d1212]' : ''}`}>
                  <span className="w-8 shrink-0 select-none border-r border-[#21262d] pr-1 text-right font-mono text-[10px] text-slate-600">
                    {pair.left?.oldLine ?? ''}
                  </span>
                  <span className={`w-4 shrink-0 select-none text-center font-mono text-[11px] ${pair.left?.type === 'remove' ? 'text-red-500' : 'text-slate-600'}`}>
                    {pair.left?.type === 'remove' ? '-' : pair.left ? ' ' : ''}
                  </span>
                  <span className={`min-w-0 flex-1 whitespace-pre-wrap break-all pr-1 font-mono text-[12px] ${pair.left?.type === 'remove' ? 'text-red-300' : 'text-slate-300'}`}>
                    {pair.left?.text ?? ''}
                  </span>
                </div>
                <div className={`flex min-w-0 flex-1 leading-5 ${pair.right?.type === 'add' ? 'bg-[#0d4428]' : ''}`}>
                  <span className="w-8 shrink-0 select-none border-r border-[#21262d] pr-1 text-right font-mono text-[10px] text-slate-600">
                    {pair.right?.newLine ?? ''}
                  </span>
                  <span className={`w-4 shrink-0 select-none text-center font-mono text-[11px] ${pair.right?.type === 'add' ? 'text-emerald-500' : 'text-slate-600'}`}>
                    {pair.right?.type === 'add' ? '+' : pair.right ? ' ' : ''}
                  </span>
                  <span className={`min-w-0 flex-1 whitespace-pre-wrap break-all pr-1 font-mono text-[12px] ${pair.right?.type === 'add' ? 'text-emerald-200' : 'text-slate-300'}`}>
                    {pair.right?.text ?? ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
