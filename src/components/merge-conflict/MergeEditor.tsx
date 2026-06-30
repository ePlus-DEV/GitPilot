import { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { ChevronLeft, ChevronRight, Save, X, SkipForward } from 'lucide-react';
import type { ConflictFileData } from '../../types/git';
import { gpConfirm } from '../common/Dialog';
import { findConflicts, resolveBlock, resolveAll, hasConflicts, countConflicts, type ResolveChoice } from './diff3-model';

interface Props {
  fileData: ConflictFileData;
  onSave: (content: string) => void;
  onClose: () => void;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  rs: 'rust', py: 'python', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
  cs: 'csharp', rb: 'ruby', php: 'php', json: 'json', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', md: 'markdown', html: 'html', css: 'css', scss: 'scss', sql: 'sql',
  sh: 'shell', bash: 'shell', kt: 'kotlin', swift: 'swift', dart: 'dart',
};

function getLang(path: string): string {
  return LANG_MAP[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';
}

const EDITOR_OPTS: MonacoEditorNS.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 12,
  lineNumbers: 'on',
  folding: false,
  wordWrap: 'off',
  renderWhitespace: 'none',
  occurrencesHighlight: 'off',
  selectionHighlight: false,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
};

export function MergeEditor({ fileData, onSave, onClose }: Props) {
  const outputEditorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const decorCollRef = useRef<MonacoEditorNS.IEditorDecorationsCollection | null>(null);
  const currentConflictRef = useRef(0);
  const [currentConflict, setCurrentConflict] = useState(0);
  const [conflictCount, setConflictCount] = useState(() => countConflicts(fileData.workingContent));
  const lang = getLang(fileData.path);
  const fileName = fileData.path.split('/').pop() ?? fileData.path;

  const refreshDecorations = useCallback((currentIdx: number) => {
    const editor = outputEditorRef.current;
    const coll = decorCollRef.current;
    if (!editor || !coll) return;
    const content = editor.getValue();
    const blocks = findConflicts(content);
    setConflictCount(blocks.length);
    if (currentIdx >= blocks.length && blocks.length > 0) {
      setCurrentConflict(blocks.length - 1);
    }
    const decos: MonacoEditorNS.IModelDeltaDecoration[] = [];
    for (const block of blocks) {
      const isCurrent = block.index === currentIdx;
      const cls = isCurrent ? 'mc-active' : '';
      decos.push({
        range: { startLineNumber: block.startLine, startColumn: 1, endLineNumber: block.startLine, endColumn: 9999 },
        options: { isWholeLine: true, className: `mc-ours-marker ${cls}`.trim() },
      });
      if (block.oursLines.length > 0) {
        const s = block.startLine + 1, e = block.startLine + block.oursLines.length;
        decos.push({
          range: { startLineNumber: s, startColumn: 1, endLineNumber: e, endColumn: 9999 },
          options: { isWholeLine: true, className: `mc-ours-content ${cls}`.trim() },
        });
      }
      const sep = block.startLine + block.oursLines.length + 1;
      decos.push({
        range: { startLineNumber: sep, startColumn: 1, endLineNumber: sep, endColumn: 9999 },
        options: { isWholeLine: true, className: 'mc-separator' },
      });
      if (block.theirsLines.length > 0) {
        const s = sep + 1, e = sep + block.theirsLines.length;
        decos.push({
          range: { startLineNumber: s, startColumn: 1, endLineNumber: e, endColumn: 9999 },
          options: { isWholeLine: true, className: `mc-theirs-content ${cls}`.trim() },
        });
      }
      decos.push({
        range: { startLineNumber: block.endLine, startColumn: 1, endLineNumber: block.endLine, endColumn: 9999 },
        options: { isWholeLine: true, className: `mc-theirs-marker ${cls}`.trim() },
      });
    }
    coll.set(decos);
    if (blocks[currentIdx]) {
      editor.revealLineInCenter(blocks[currentIdx].startLine);
    }
  }, []);

  const handleOutputMount: OnMount = (editor) => {
    outputEditorRef.current = editor;
    decorCollRef.current = editor.createDecorationsCollection([]);
    refreshDecorations(0);
    let timer: ReturnType<typeof setTimeout>;
    editor.onDidChangeModelContent(() => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshDecorations(currentConflictRef.current), 200);
    });
  };

  useEffect(() => {
    refreshDecorations(currentConflict);
  }, [currentConflict, refreshDecorations]);

  const applyResolve = useCallback((choice: ResolveChoice) => {
    const editor = outputEditorRef.current;
    if (!editor) return;
    const content = editor.getValue();
    const blocks = findConflicts(content);
    if (blocks.length === 0) return;
    const newContent = resolveBlock(content, blocks, currentConflict, choice);
    editor.getModel()?.setValue(newContent);
    const newBlocks = findConflicts(newContent);
    const next = Math.min(currentConflict, Math.max(0, newBlocks.length - 1));
    currentConflictRef.current = next;
    setCurrentConflict(next);
    setTimeout(() => refreshDecorations(next), 0);
  }, [currentConflict, refreshDecorations]);

  const applyResolveAll = useCallback((choice: 'ours' | 'theirs') => {
    const editor = outputEditorRef.current;
    if (!editor) return;
    const newContent = resolveAll(editor.getValue(), choice);
    editor.getModel()?.setValue(newContent);
    currentConflictRef.current = 0;
    setCurrentConflict(0);
    setTimeout(() => refreshDecorations(0), 0);
  }, [refreshDecorations]);

  const handleSave = async () => {
    const editor = outputEditorRef.current;
    if (!editor) return;
    const content = editor.getValue();
    if (hasConflicts(content) && !await gpConfirm('Conflict markers remain. Save anyway?')) return;
    onSave(content);
  };

  const goNext = () => {
    const next = Math.min(conflictCount - 1, currentConflict + 1);
    currentConflictRef.current = next;
    setCurrentConflict(next);
  };
  const goPrev = () => {
    const prev = Math.max(0, currentConflict - 1);
    currentConflictRef.current = prev;
    setCurrentConflict(prev);
  };

  const blocks = findConflicts(outputEditorRef.current?.getValue() ?? fileData.workingContent);
  const currentBlock = blocks[currentConflict];

  return (
    <div className="flex h-full flex-col">
      <style>{`
        .mc-ours-marker{background:rgba(20,184,166,.12);border-left:3px solid #14b8a6}
        .mc-ours-content{background:rgba(20,184,166,.07)}
        .mc-separator{background:rgba(100,116,139,.25)}
        .mc-theirs-content{background:rgba(251,146,60,.07)}
        .mc-theirs-marker{background:rgba(251,146,60,.12);border-left:3px solid #fb923c}
        .mc-active.mc-ours-marker{background:rgba(20,184,166,.22)}
        .mc-active.mc-ours-content{background:rgba(20,184,166,.15)}
        .mc-active.mc-theirs-marker{background:rgba(251,146,60,.22)}
        .mc-active.mc-theirs-content{background:rgba(251,146,60,.15)}
      `}</style>

      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-pilot-line bg-[#161b22] px-3 py-2">
        <span className="flex-1 truncate font-mono text-[11px] text-slate-300">{fileData.path}</span>
        {conflictCount > 0
          ? <span className="shrink-0 rounded bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400">{conflictCount} conflict{conflictCount !== 1 ? 's' : ''}</span>
          : <span className="shrink-0 rounded bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-400">Resolved</span>}
        <button className="btn-primary h-7 gap-1 text-xs" onClick={handleSave}>
          <Save size={11} /> Save + Stage
        </button>
        <button className="icon-btn h-7" onClick={onClose} title="Close"><X size={14} /></button>
      </div>

      {/* Top: Ours | Theirs */}
      <div className="flex min-h-0 shrink-0 basis-[38%] overflow-hidden border-b border-pilot-line">
        <div className="flex min-w-0 flex-1 flex-col border-r border-pilot-line">
          <div className="flex shrink-0 items-center justify-between border-b border-pilot-line bg-teal-950/50 px-3 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
              Current / Ours{currentBlock ? ` · ${currentBlock.oursLabel}` : ''}
            </span>
            <button className="btn h-6 border-teal-700/40 bg-teal-900/30 text-[10px] text-teal-300 hover:bg-teal-900/60" onClick={() => applyResolveAll('ours')}>Take All</button>
          </div>
          <div className="min-h-0 flex-1">
            <Editor height="100%" theme="vs-dark" value={fileData.oursContent ?? ''} language={lang}
              options={{ ...EDITOR_OPTS, readOnly: true }} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-pilot-line bg-orange-950/50 px-3 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
              Incoming / Theirs{currentBlock ? ` · ${currentBlock.theirsLabel}` : ''}
            </span>
            <button className="btn h-6 border-orange-700/40 bg-orange-900/30 text-[10px] text-orange-300 hover:bg-orange-900/60" onClick={() => applyResolveAll('theirs')}>Take All</button>
          </div>
          <div className="min-h-0 flex-1">
            <Editor height="100%" theme="vs-dark" value={fileData.theirsContent ?? ''} language={lang}
              options={{ ...EDITOR_OPTS, readOnly: true }} />
          </div>
        </div>
      </div>

      {/* Conflict nav */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-pilot-line bg-[#161b22] px-3 py-1.5">
        {conflictCount > 0 ? (
          <>
            <span className="text-[10px] text-slate-400">
              {currentConflict + 1}/{conflictCount}
            </span>
            <button className="icon-btn h-6 w-6" onClick={goPrev} disabled={currentConflict === 0}><ChevronLeft size={12} /></button>
            <button className="icon-btn h-6 w-6" onClick={goNext} disabled={currentConflict >= conflictCount - 1}><ChevronRight size={12} /></button>
            <div className="mx-1 h-3 w-px bg-pilot-line" />
            <button
              className="btn h-6 border-teal-600/40 bg-teal-900/25 text-[10px] text-teal-300 hover:bg-teal-900/50"
              onClick={() => applyResolve('ours')}
            >← Take Current</button>
            <button
              className="btn h-6 border-orange-600/40 bg-orange-900/25 text-[10px] text-orange-300 hover:bg-orange-900/50"
              onClick={() => applyResolve('theirs')}
            >Take Incoming →</button>
            <button className="btn h-6 text-[10px]" onClick={() => applyResolve('both')}>Both</button>
            <button className="btn h-6 text-[10px]" onClick={() => applyResolve('theirs-then-ours')}>Reversed</button>
            <button className="icon-btn ml-auto h-6 gap-1 text-[10px]" onClick={goNext} title="Skip this conflict">
              <SkipForward size={11} />
            </button>
          </>
        ) : (
          <span className="text-[10px] text-teal-400">All conflicts resolved — click Save + Stage</span>
        )}
      </div>

      {/* Output editor */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center border-b border-pilot-line bg-[#161b22] px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Result · {fileName}</span>
          <span className="ml-auto text-[10px] text-slate-600">Edit directly or use buttons above</span>
        </div>
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            theme="vs-dark"
            defaultValue={fileData.workingContent}
            language={lang}
            onMount={handleOutputMount}
            options={{ ...EDITOR_OPTS, glyphMargin: false }}
          />
        </div>
      </div>
    </div>
  );
}
