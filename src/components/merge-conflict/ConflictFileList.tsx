import { GitMerge, CheckCircle, AlertCircle } from 'lucide-react';
import type { GitFileStatus } from '../../types/git';

interface Props {
  files: GitFileStatus[];
  resolvedPaths: Set<string>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function ConflictFileList({ files, resolvedPaths, selectedPath, onSelect }: Props) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <CheckCircle size={24} className="text-teal-400" />
        <p className="text-xs text-teal-400">All conflicts resolved</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col overflow-y-auto">
      {files.map(f => {
        const resolved = resolvedPaths.has(f.path);
        const active = selectedPath === f.path;
        const name = f.path.split('/').pop() ?? f.path;
        const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
        return (
          <button
            key={f.path}
            onClick={() => onSelect(f.path)}
            className={`flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5 ${active ? 'bg-pilot-blue/15 border-l-2 border-pilot-blue' : 'border-l-2 border-transparent'}`}
          >
            {resolved
              ? <CheckCircle size={13} className="shrink-0 text-teal-400" />
              : <AlertCircle size={13} className="shrink-0 text-orange-400" />}
            <div className="min-w-0 flex-1">
              <div className={`truncate text-xs font-medium ${resolved ? 'text-teal-300' : 'text-slate-200'}`}>{name}</div>
              {dir && <div className="truncate text-[10px] text-slate-500">{dir}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
