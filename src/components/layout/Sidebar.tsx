import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Archive, FolderGit2, GitBranch, GitMerge, Globe, Plus, RotateCcw, Tag, Trash2 } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { BranchInfo } from '../../types/git';

export function Sidebar() {
  const recent = useGitStore(s => s.recent);
  const repoInfo = useGitStore(s => s.repo);
  const branches = useGitStore(s => s.branches);
  const remotes = useGitStore(s => s.remotes);
  const tags = useGitStore(s => s.tags);
  const stashes = useGitStore(s => s.stashes);
  const mergeState = useGitStore(s => s.status.mergeState);
  const openRepo = useGitStore(s => s.openRepo);
  const closeRepo = useGitStore(s => s.closeRepo);
  const run = useGitStore(s => s.run);
  const [newBranch, setNewBranch] = useState('');
  const [branchMenu, setBranchMenu] = useState<{ x: number; y: number; branch: BranchInfo }>();
  const repo = repoInfo?.path;

  const removeRecent = async (path: string) => {
    const nextRecent = await gitService.removeRecentRepository(path);
    useGitStore.setState({ recent: nextRecent });
    if (repoInfo?.path !== path) return;
    const nextRepo = nextRecent.find(r => r !== path);
    if (nextRepo) void openRepo(nextRepo);
    else closeRepo();
  };
  const ask = (message: string, fallback: string) => prompt(message, fallback)?.trim();
  const branchRef = (branch: BranchInfo) => branch.name.replace(/^remotes\//, '');
  const branchDisplay = (branch: BranchInfo, remote?: string) => {
    const ref = branchRef(branch);
    return remote && ref.startsWith(remote + '/') ? ref.slice(remote.length + 1) : ref;
  };
  const branchMenuItems = (branch: BranchInfo): ContextMenuItem[] => {
    const ref = branchRef(branch);
    const remoteName = remotes[0]?.name ?? 'origin';
    const canWriteLocal = !branch.remote;
    const currentBranch = repoInfo?.currentBranch || 'current branch';
    const separator = (label: string): ContextMenuItem => ({ label, separator: true, action: () => undefined });
    const copyText = (label: string, value: string) => {
      void navigator.clipboard.writeText(value).then(() => useGitStore.getState().log(`${label}: ${value}`)).catch(() => useGitStore.getState().log(value));
    };
    return [
      {
        label: 'Checkout branch',
        action: () => repo && void run('checkout', () => gitService.checkoutBranch(repo, ref)),
      },
      {
        label: `Create worktree from ${ref}`,
        action: () => {
          const path = ask('Worktree path', `../worktree-${branchDisplay(branch)}`);
          if (path && repo) void run('create worktree', () => gitService.createWorktree(repo, path, ref, false));
        },
      },
      separator('branch-actions'),
      {
        label: 'Create branch here',
        action: () => {
          const name = ask('New branch name', `${branchDisplay(branch)}-copy`);
          if (name && repo) void run('branch from ref', () => gitService.createBranchFromCommit(repo, name, ref, true));
        },
      },
      {
        label: 'Merge into current branch',
        action: () => {
          if (confirm(`Merge ${ref} into current branch?`)) repo && void run('merge branch', () => gitService.mergeBranch(repo, ref));
        },
      },
      {
        label: 'Compare with HEAD',
        action: () => repo && void run('compare branch', () => gitService.compareBranch(repo, ref), 'none'),
      },
      {
        label: `Reset ${currentBranch} to ${ref}: soft`,
        disabled: branch.current,
        action: () => {
          if (confirm(`Soft reset ${currentBranch} to ${ref}?`)) repo && void run('soft reset', () => gitService.resetToCommit(repo, ref, 'soft'));
        },
      },
      {
        label: `Reset ${currentBranch} to ${ref}: mixed`,
        disabled: branch.current,
        action: () => {
          if (confirm(`Mixed reset ${currentBranch} to ${ref}?`)) repo && void run('mixed reset', () => gitService.resetToCommit(repo, ref, 'mixed'));
        },
      },
      {
        label: `Reset ${currentBranch} to ${ref}: hard`,
        danger: true,
        disabled: branch.current,
        action: () => {
          if (confirm(`Hard reset ${currentBranch} to ${ref}? This can discard work.`)) repo && void run('hard reset', () => gitService.resetToCommit(repo, ref, 'hard'));
        },
      },
      separator('remote-actions'),
      {
        label: 'Rename branch',
        disabled: !canWriteLocal,
        action: () => {
          const next = ask('New branch name', branch.name);
          if (next && repo) void run('rename branch', () => gitService.renameBranch(repo, branch.name, next));
        },
      },
      {
        label: `Push to ${remoteName}`,
        disabled: !canWriteLocal,
        action: () => repo && void run('push branch', () => gitService.pushNewBranch(repo, remoteName, branch.name)),
      },
      {
        label: `Fetch ${remoteName}`,
        action: () => repo && void run('fetch', () => gitService.fetch(repo, remoteName)),
      },
      separator('delete-actions'),
      {
        label: 'Delete branch',
        danger: true,
        disabled: !canWriteLocal || branch.current,
        action: () => {
          if (confirm(`Delete ${branch.name}?`)) repo && void run('delete branch', () => gitService.deleteBranch(repo, branch.name, false));
        },
      },
      {
        label: 'Force delete branch',
        danger: true,
        disabled: !canWriteLocal || branch.current,
        action: () => {
          if (confirm(`Force delete ${branch.name}? This can discard unmerged commits.`)) repo && void run('force delete branch', () => gitService.deleteBranch(repo, branch.name, true));
        },
      },
      separator('copy-actions'),
      {
        label: 'Copy branch name',
        action: () => copyText('Copied branch name', ref),
      },
    ];
  };

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-pilot-line bg-[#0a0f1e]">
      <div className="flex-1 overflow-auto py-2">
        <Section icon={<FolderGit2 size={13} />} title="Repositories">
          {recent.length === 0
            ? <div className="px-3 py-1 text-[11px] text-slate-600">No recent repos</div>
            : recent.map(r => (
              <SidebarRow
                key={r}
                label={r.split(/[\\/]/).pop() ?? r}
                title={r}
                onClick={() => void openRepo(r)}
                active={repoInfo?.path === r}
                onDelete={() => void removeRecent(r)}
              />
            ))
          }
        </Section>

        <Section icon={<GitBranch size={13} />} title="Local Branches">
          <div className="flex gap-1 px-2 pb-1">
            <input
              className="input h-6 flex-1 px-1.5 text-[11px]"
              value={newBranch}
              onChange={e => setNewBranch(e.target.value)}
              placeholder="new branch..."
              onKeyDown={e => {
                if (e.key === 'Enter' && newBranch && repo) {
                  void run('create branch', () => gitService.createBranch(repo, newBranch, true));
                  setNewBranch('');
                }
              }}
            />
            <button
              className="icon-btn flex h-6 w-6 items-center justify-center p-0"
              title="Create branch"
              disabled={!newBranch || !repo}
              onClick={() => {
                if (!newBranch || !repo) return;
                void run('create branch', () => gitService.createBranch(repo, newBranch, true));
                setNewBranch('');
              }}
            >
              <Plus size={11} />
            </button>
          </div>
          {branches.filter(b => !b.remote).map(b => (
            <SidebarRow
              key={b.name}
              label={b.name}
              active={b.current}
              icon={b.current ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pilot-blue" /> : undefined}
              onClick={() => repo && void run('checkout', () => gitService.checkoutBranch(repo, b.name))}
              onDelete={() => repo && void run('delete branch', () => gitService.deleteBranch(repo, b.name, false))}
              onContextMenu={event => {
                event.preventDefault();
                setBranchMenu({ x: event.clientX, y: event.clientY, branch: b });
              }}
              meta={b.ahead || b.behind ? `up ${b.ahead} down ${b.behind}` : undefined}
            />
          ))}
        </Section>

        <Section icon={<Globe size={13} />} title="Remotes">
          {remotes.map(r => (
            <div key={r.name}>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">{r.name}</div>
              {branches.filter(b => b.remote && branchRef(b).startsWith(r.name + '/')).map(b => (
                <SidebarRow
                  key={b.name}
                  label={branchDisplay(b, r.name)}
                  onClick={() => repo && void run('checkout', () => gitService.checkoutBranch(repo, branchRef(b)))}
                  onContextMenu={event => {
                    event.preventDefault();
                    setBranchMenu({ x: event.clientX, y: event.clientY, branch: b });
                  }}
                />
              ))}
            </div>
          ))}
          {remotes.length === 0 && <div className="px-3 py-1 text-[11px] text-slate-600">No remotes</div>}
        </Section>

        <Section icon={<Tag size={13} />} title="Tags">
          {tags.map(t => (
            <SidebarRow
              key={t.name}
              label={t.name}
              onDelete={() => repo && void run('delete tag', () => gitService.deleteTag(repo, t.name))}
            />
          ))}
          {tags.length === 0 && <div className="px-3 py-1 text-[11px] text-slate-600">No tags</div>}
        </Section>

        <Section icon={<Archive size={13} />} title="Stashes">
          <div className="px-2 pb-1">
            <button
              className="icon-btn h-6 w-full justify-center text-[11px]"
              disabled={!repo}
              onClick={() => repo && void run('stash', () => gitService.createStash(repo, 'GitPilot stash'))}
            >
              <Archive size={11} /> Stash changes
            </button>
          </div>
          {stashes.map(st => (
            <SidebarRow
              key={st.name}
              label={st.message || st.name}
              onAction={() => repo && void run('pop stash', () => gitService.popStash(repo, st.name))}
              actionIcon={<RotateCcw size={11} />}
              actionTitle="Pop stash"
              onDelete={() => repo && void run('drop stash', () => gitService.dropStash(repo, st.name))}
            />
          ))}
          {stashes.length === 0 && <div className="px-3 py-1 text-[11px] text-slate-600">No stashes</div>}
        </Section>
      </div>

      {(mergeState.isMerging || mergeState.isRebasing) && (
        <div className="shrink-0 border-t border-pilot-line bg-amber-950/40 p-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <GitMerge size={12} />
            {mergeState.isMerging ? 'Merge in progress' : 'Rebase in progress'}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {mergeState.conflictedFiles.length} conflict(s)
          </div>
        </div>
      )}
      {branchMenu && (
        <ContextMenu
          x={branchMenu.x}
          y={branchMenu.y}
          title={branchRef(branchMenu.branch)}
          items={branchMenuItems(branchMenu.branch)}
          onClose={() => setBranchMenu(undefined)}
        />
      )}
    </aside>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <span className="text-slate-600">{open ? 'v' : '>'}</span>
      </button>
      {open && <div className="space-y-0.5 pb-1">{children}</div>}
    </section>
  );
}

function SidebarRow({
  label, title, active, icon, meta, onClick, onContextMenu, onDelete, onAction, actionIcon, actionTitle,
}: {
  label: string;
  title?: string;
  active?: boolean;
  icon?: ReactNode;
  meta?: string;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
  onDelete?: () => void;
  onAction?: () => void;
  actionIcon?: ReactNode;
  actionTitle?: string;
}) {
  return (
    <div
      className={`group flex cursor-default items-center gap-1.5 rounded-none px-3 py-1 hover:bg-slate-800/60 ${active ? 'bg-slate-800/80' : ''}`}
      onContextMenu={onContextMenu}
    >
      {icon}
      <button
        className={`min-w-0 flex-1 truncate text-left text-[12px] ${active ? 'font-semibold text-pilot-blue' : 'text-slate-300'}`}
        title={title ?? label}
        onClick={onClick}
      >
        {label}
      </button>
      {meta && <span className="shrink-0 text-[10px] text-slate-500">{meta}</span>}
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        {onAction && (
          <button
            className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            title={actionTitle}
            onClick={e => {
              e.stopPropagation();
              onAction();
            }}
          >
            {actionIcon}
          </button>
        )}
        {onDelete && (
          <button
            className="rounded p-0.5 text-slate-400 hover:bg-red-900/60 hover:text-red-400"
            title="Delete"
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
