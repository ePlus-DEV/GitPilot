import Editor, { DiffEditor } from '@monaco-editor/react';
import { Columns2, Rows3 } from 'lucide-react';
import { useState } from 'react';
import { useGitStore } from '../../store/gitStore';

export function DiffViewer() {
  const diff = useGitStore(s => s.diff);
  const [mode, setMode] = useState<'side' | 'inline'>('side');

  if (!diff) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
        Select a changed file or commit file to view its diff.
      </div>
    );
  }

  if (diff.binary) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-amber-300">
        Binary file diff cannot be displayed: {diff.filePath}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#090e1b]">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-pilot-line px-3 py-2">
        <span className="min-w-0 truncate text-xs font-medium text-slate-200" title={diff.filePath}>
          {diff.filePath}
        </span>
        <button
          className="icon-btn shrink-0"
          title={mode === 'side' ? 'Show inline diff' : 'Show side-by-side diff'}
          onClick={() => setMode(mode === 'side' ? 'inline' : 'side')}
        >
          {mode === 'side' ? <Rows3 size={13} /> : <Columns2 size={13} />}
          <span>{mode === 'side' ? 'Inline' : 'Split'}</span>
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'side' ? (
          <DiffEditor
            height="100%"
            theme="vs-dark"
            original={diff.oldText}
            modified={diff.newText}
            language={language(diff.filePath)}
            options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, scrollBeyondLastLine: false }}
          />
        ) : (
          <Editor
            height="100%"
            theme="vs-dark"
            value={diff.patch}
            language="diff"
            options={{ readOnly: true, wordWrap: 'on', minimap: { enabled: false }, scrollBeyondLastLine: false }}
          />
        )}
      </div>
    </div>
  );
}

function language(p: string) {
  if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
  if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
  if (p.endsWith('.rs')) return 'rust';
  if (p.endsWith('.php')) return 'php';
  if (p.endsWith('.json')) return 'json';
  return 'plaintext';
}
