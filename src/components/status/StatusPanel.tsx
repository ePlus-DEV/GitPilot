import { useState } from 'react';
import { ChevronRight, FilePlus2, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { gpConfirm } from '../common/Dialog';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { GitFileStatus } from '../../types/git';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';

export function StatusPanel() {
  const status = useGitStore(s => s.status);
  const repo = useGitStore(s => s.repo?.path);
  const run = useGitStore(s => s.run);
  const loadConflict = useGitStore(s => s.loadConflict);
  const [stagedOpen, setStagedOpen] = useState(true);
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number; file: GitFileStatus; cached: boolean; conflicted?: boolean }>();

  const act = (label: string, fn: () => Promise<unknown>) => repo && run(label, fn, 'status');
  const copyPath = (path: string) => void navigator.clipboard.writeText(path).then(() => useGitStore.getState().log(`Copied path: ${path}`));
  const fileMenuItems = ({ file, cached, conflicted }: NonNullable<typeof menu>): ContextMenuItem[] => [
    {
      label: cached ? 'Unstage file' : conflicted ? 'Open resolver' : 'Stage file',
      action: () => { if (cached) act('unstage', () => gitService.unstageFile(repo!, file.path)); else if (conflicted) void loadConflict(file.path); else act('stage', () => gitService.stageFile(repo!, file.path)); },
    },
    {
      label: 'Show diff',
      action: () => void useGitStore.getState().setSelectedFile(file, cached),
    },
    { label: 'file-separator', separator: true, action: () => undefined },
    {
      label: 'Discard changes',
      danger: true,
      disabled: cached || conflicted || file.worktreeStatus === '?',
      action: async () => { if (repo && await gpConfirm(`Discard ${file.path}?`, true)) void run('discard', () => gitService.discardFile(repo, file.path), 'status'); },
    },
    {
      label: 'Delete untracked file',
      danger: true,
      disabled: file.worktreeStatus !== '?' && file.indexStatus !== '?',
      action: async () => { if (repo && await gpConfirm(`Delete ${file.path}?`, true)) void run('delete', () => gitService.deleteUntrackedFile(repo, file.path), 'status'); },
    },
    { label: 'copy-separator', separator: true, action: () => undefined },
    {
      label: 'Copy relative path',
      action: () => copyPath(file.path),
    },
  ];

  const staged = status.staged;
  const unstaged = [...status.unstaged, ...status.untracked, ...status.conflicted];
  const stagedCount = staged.length;
  const unstagedCount = unstaged.length;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Staged section */}
      <div className="shrink-0 border-b border-pilot-line/60">
        <div className="flex items-center gap-1 bg-[#161b22] px-2 py-1.5">
          <button
            className="flex flex-1 items-center gap-1.5 text-left"
            onClick={() => setStagedOpen(o => !o)}
          >
            <ChevronRight
              size={12}
              className={`shrink-0 text-slate-500 transition-transform ${stagedOpen ? 'rotate-90' : ''}`}
            />
            <span className="text-[11px] font-semibold text-slate-400">
              Staged ({stagedCount})
            </span>
          </button>
          {repo && (
            <button
              className="rounded p-0.5 text-slate-500 hover:bg-[#30363d] hover:text-slate-200"
              title="Stage all"
              onClick={() => act('stage all', () => gitService.stageAll(repo))}
            >
              <Plus size={12} />
            </button>
          )}
          {repo && (
            <button
              className="rounded p-0.5 text-slate-500 hover:bg-[#30363d] hover:text-slate-200"
              title="Unstage all"
              onClick={() => act('unstage all', () => gitService.unstageAll(repo))}
            >
              <Minus size={12} />
            </button>
          )}
        </div>
        {stagedOpen && stagedCount > 0 && (
          <div className="overflow-auto">
            {staged.map(f => (
              <FileRow
                key={'s-' + f.path}
                file={f}
                action="Unstage"
                actionIcon={<Minus size={11} />}
                onAction={() => act('unstage', () => gitService.unstageFile(repo!, f.path))}
                onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, file: f, cached: true }); }}
                cached
              />
            ))}
          </div>
        )}
        {stagedOpen && stagedCount === 0 && (
          <div className="px-6 py-2 text-[11px] text-slate-500">No staged files</div>
        )}
      </div>

      {/* Unstaged section */}
      <div className="flex min-h-0 flex-col border-b border-pilot-line/60">
        <div className="flex items-center gap-1 bg-[#161b22] px-2 py-1.5">
          <button
            className="flex flex-1 items-center gap-1.5 text-left"
            onClick={() => setUnstagedOpen(o => !o)}
          >
            <ChevronRight
              size={12}
              className={`shrink-0 text-slate-500 transition-transform ${unstagedOpen ? 'rotate-90' : ''}`}
            />
            <span className="text-[11px] font-semibold text-slate-400">
              Unstaged ({unstagedCount})
            </span>
          </button>
          {repo && unstagedCount > 0 && (
            <button
              className="rounded p-0.5 text-slate-500 hover:bg-[#30363d] hover:text-slate-200"
              title="Stage all changes"
              onClick={() => act('stage all', () => gitService.stageAll(repo))}
            >
              <Plus size={12} />
            </button>
          )}
        </div>
        {unstagedOpen && (
          <div className="min-h-0 flex-1 overflow-auto">
            {status.unstaged.map(f => (
              <FileRow
                key={'u-' + f.path}
                file={f}
                action="Stage"
                actionIcon={<Plus size={11} />}
                onAction={() => act('stage', () => gitService.stageFile(repo!, f.path))}
                onDiscard={async () => repo && await gpConfirm(`Discard ${f.path}?`, true) && run('discard', () => gitService.discardFile(repo, f.path), 'status')}
                onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, file: f, cached: false }); }}
              />
            ))}
            {status.untracked.map(f => (
              <FileRow
                key={'n-' + f.path}
                file={f}
                action="Add"
                actionIcon={<FilePlus2 size={11} />}
                onAction={() => act('stage', () => gitService.stageFile(repo!, f.path))}
                onDelete={async () => repo && await gpConfirm(`Delete ${f.path}?`, true) && run('delete', () => gitService.deleteUntrackedFile(repo, f.path), 'status')}
                onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, file: f, cached: false }); }}
              />
            ))}
            {status.conflicted.map(f => (
              <FileRow
                key={'c-' + f.path}
                file={f}
                action="Resolve"
                actionIcon={<FilePlus2 size={11} />}
                onAction={() => void loadConflict(f.path)}
                onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, file: f, cached: false, conflicted: true }); }}
                conflicted
              />
            ))}
            {unstagedCount === 0 && (
              <div className="px-6 py-2 text-[11px] text-slate-500">No unstaged changes</div>
            )}
          </div>
        )}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={menu.file.path}
          items={fileMenuItems(menu)}
          onClose={() => setMenu(undefined)}
        />
      )}
    </section>
  );
}

function FileRow({
  file,
  action,
  actionIcon,
  onAction,
  onDiscard,
  onDelete,
  onContextMenu,
  cached = false,
  conflicted = false,
}: {
  file: GitFileStatus;
  action: string;
  actionIcon: React.ReactNode;
  onAction: () => void;
  onDiscard?: () => void;
  onDelete?: () => void;
  onContextMenu?: React.MouseEventHandler;
  cached?: boolean;
  conflicted?: boolean;
}) {
  const select = useGitStore(st => st.setSelectedFile);

  return (
    <div className="group flex h-7 items-center gap-1.5 px-3 hover:bg-[#21262d]/60" onContextMenu={onContextMenu}>
      <span className={`w-4 shrink-0 text-center font-mono text-[10px] ${conflicted ? 'text-red-400' : 'text-pilot-blue'}`}>
        {file.displayStatus || (file.indexStatus + file.worktreeStatus).trim() || '?'}
      </span>
      <button
        onClick={() => void select(file, cached)}
        className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-300"
        title={file.path}
      >
        {file.path}
      </button>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          className="rounded p-0.5 text-slate-400 hover:bg-[#30363d] hover:text-slate-200"
          title={action}
          onClick={e => { e.stopPropagation(); onAction(); }}
        >
          {actionIcon}
        </button>
        {onDiscard && (
          <button
            className="rounded p-0.5 text-slate-400 hover:bg-[#30363d] hover:text-slate-200"
            title="Discard changes"
            onClick={e => { e.stopPropagation(); onDiscard(); }}
          >
            <RotateCcw size={11} />
          </button>
        )}
        {onDelete && (
          <button
            className="rounded p-0.5 text-red-400 hover:bg-red-900/60 hover:text-red-300"
            title="Delete file"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
