import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Archive, FolderGit2, GitBranch, GitMerge, Globe, RotateCcw, Search, Settings2, Tag, Trash2, X } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../common/ContextMenu';
import { useGitStore, startAutoFetch } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { BranchInfo } from '../../types/git';
import { gpPrompt, gpConfirm } from '../common/Dialog';
import { getRepoConfig, setRepoConfig } from '../../utils/repoConfig';

const FETCH_OPTIONS = [
  { label: 'Inherit global', value: -1 },
  { label: 'Disabled',       value: 0 },
  { label: '30 seconds',     value: 30 },
  { label: '1 minute',       value: 60 },
  { label: '5 minutes',      value: 300 },
  { label: '10 minutes',     value: 600 },
  { label: '30 minutes',     value: 1800 },
];

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
  const [branchMenu, setBranchMenu] = useState<{ x: number; y: number; branch: BranchInfo }>();
  const [configPath, setConfigPath] = useState<string | null>(null);
  const globalFetchInterval = useGitStore(s => s.settings?.autoFetchInterval ?? 0);
  const repo = repoInfo?.path;

  const removeRecent = async (path: string) => {
    const nextRecent = await gitService.removeRecentRepository(path);
    useGitStore.setState({ recent: nextRecent });
    if (repoInfo?.path !== path) return;
    const nextRepo = nextRecent.find(r => r !== path);
    if (nextRepo) void openRepo(nextRepo);
    else closeRepo();
  };
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
      { label: 'Checkout branch', action: () => { if (repo) void run('checkout', () => gitService.checkoutBranch(repo, ref)); } },
      { label: `Create worktree from ${ref}`, action: async () => { const path = await gpPrompt('Worktree path', `../worktree-${branchDisplay(branch)}`); if (path && repo) void run('create worktree', () => gitService.createWorktree(repo, path, ref, false)); } },
      separator('branch-actions'),
      { label: 'Create branch here', action: async () => { const name = await gpPrompt('New branch name', `${branchDisplay(branch)}-copy`); if (name && repo) void run('branch from ref', () => gitService.createBranchFromCommit(repo, name, ref, true)); } },
      { label: 'Merge into current branch', action: async () => { if (await gpConfirm(`Merge ${ref} into current branch?`)) { if (repo) void run('merge branch', () => gitService.mergeBranch(repo, ref)); } } },
      { label: 'Compare with HEAD', action: () => { if (repo) void run('compare branch', () => gitService.compareBranch(repo, ref), 'none'); } },
      { label: `Reset ${currentBranch} to ${ref}: soft`, disabled: branch.current, action: async () => { if (await gpConfirm(`Soft reset ${currentBranch} to ${ref}?`)) { if (repo) void run('soft reset', () => gitService.resetToCommit(repo, ref, 'soft')); } } },
      { label: `Reset ${currentBranch} to ${ref}: mixed`, disabled: branch.current, action: async () => { if (await gpConfirm(`Mixed reset ${currentBranch} to ${ref}?`)) { if (repo) void run('mixed reset', () => gitService.resetToCommit(repo, ref, 'mixed')); } } },
      { label: `Reset ${currentBranch} to ${ref}: hard`, danger: true, disabled: branch.current, action: async () => { if (await gpConfirm(`Hard reset ${currentBranch} to ${ref}? This can discard work.`, true)) { if (repo) void run('hard reset', () => gitService.resetToCommit(repo, ref, 'hard')); } } },
      separator('remote-actions'),
      { label: 'Rename branch', disabled: !canWriteLocal, action: async () => { const next = await gpPrompt('New branch name', branch.name); if (next && repo) void run('rename branch', () => gitService.renameBranch(repo, branch.name, next)); } },
      { label: `Push to ${remoteName}`, disabled: !canWriteLocal, action: () => { if (repo) void run('push branch', () => gitService.pushNewBranch(repo, remoteName, branch.name)); } },
      { label: `Pull from ${remoteName}`, disabled: !branch.current, action: () => { if (repo) void run('pull', () => gitService.pull(repo)); } },
      { label: `Fetch ${remoteName}`, action: () => { if (repo) void run('fetch', () => gitService.fetch(repo, remoteName)); } },
      separator('delete-actions'),
      { label: 'Delete branch', danger: true, disabled: !canWriteLocal || branch.current, action: async () => { if (await gpConfirm(`Delete ${branch.name}?`, true)) { if (repo) void run('delete branch', () => gitService.deleteBranch(repo, branch.name, false)); } } },
      { label: 'Force delete branch', danger: true, disabled: !canWriteLocal || branch.current, action: async () => { if (await gpConfirm(`Force delete ${branch.name}? This can discard unmerged commits.`, true)) { if (repo) void run('force delete branch', () => gitService.deleteBranch(repo, branch.name, true)); } } },
      separator('copy-actions'),
      { label: 'Copy branch name', action: () => copyText('Copied branch name', ref) },
    ];
  };

  const localBranches = branches.filter(b => !b.remote);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-pilot-line bg-[#0d1117]">
      {/* Repositories — fixed height, no search needed */}
      <Section icon={<FolderGit2 size={15} />} title="Repositories" count={recent.length} defaultOpen grow={false} color="#64748b">
        {() => recent.length === 0
          ? <div className="px-3 py-1 text-[11px] text-slate-500">No recent repos</div>
          : recent.map(r => {
            const name = r.split(/[\\/]/).pop() ?? r;
            const isActive = repoInfo?.path === r;
            const showCfg = configPath === r;
            const cfg = getRepoConfig(r);
            const cfgVal = cfg.autoFetchInterval !== undefined ? cfg.autoFetchInterval : -1;
            const globalLabel = globalFetchInterval <= 0 ? 'off' : (FETCH_OPTIONS.find(o => o.value === globalFetchInterval)?.label ?? `${globalFetchInterval}s`);
            return (
              <div key={r}>
                <SidebarRow
                  label={name}
                  title={r}
                  onClick={() => void openRepo(r)}
                  active={isActive}
                  onAction={() => setConfigPath(showCfg ? null : r)}
                  actionIcon={<Settings2 size={11} className={showCfg ? 'text-pilot-blue' : ''} />}
                  actionTitle="Per-repo auto-fetch"
                  onDelete={() => void removeRecent(r)}
                />
                {showCfg && (
                  <div className="mx-3 mb-2 rounded border border-[#30363d] bg-[#080d14] p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400">Auto-fetch — repo override</span>
                      {cfgVal === -1 && (
                        <span className="text-[10px] text-slate-500">global: {globalLabel}</span>
                      )}
                    </div>
                    <select
                      className="w-full rounded border border-[#30363d] bg-[#21262d] px-2 py-1 text-xs text-slate-200 outline-none focus:border-pilot-blue"
                      value={cfgVal}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setRepoConfig(r, { autoFetchInterval: v === -1 ? undefined : v });
                        if (isActive) startAutoFetch(v === -1 ? globalFetchInterval : v);
                      }}
                    >
                      {FETCH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })
        }
      </Section>

      {/* Local Branches — grows to fill remaining space */}
      <Section icon={<GitBranch size={15} />} title="Local Branches" count={localBranches.length} defaultOpen grow searchable color="#14b8a6">
        {q => localBranches
          .filter(b => !q || b.name.toLowerCase().includes(q))
          .map(b => (
            <SidebarRow
              key={b.name}
              label={b.name}
              active={b.current}
              icon={b.current ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pilot-blue" /> : undefined}
              onClick={() => repo && void run('checkout', () => gitService.checkoutBranch(repo, b.name))}
              onDelete={() => repo && void run('delete branch', () => gitService.deleteBranch(repo, b.name, false))}
              onContextMenu={event => { event.preventDefault(); setBranchMenu({ x: event.clientX, y: event.clientY, branch: b }); }}
              extra={(b.ahead > 0 || b.behind > 0) ? (
                <span className="flex shrink-0 items-center gap-0.5 font-mono text-[9px]">
                  {b.ahead > 0 && <span className="text-teal-400">↑{b.ahead}</span>}
                  {b.behind > 0 && <span className="text-orange-400">↓{b.behind}</span>}
                </span>
              ) : undefined}
            />
          ))
        }
      </Section>

      {/* Remotes — bounded height */}
      <Section icon={<Globe size={15} />} title="Remotes" count={remotes.length} defaultOpen={false} maxHeight={200} searchable color="#818cf8">
        {q => remotes.length === 0
          ? <div className="px-3 py-1 text-[11px] text-slate-500">No remotes</div>
          : remotes.map(r => {
            const remoteBranches = branches.filter(b => b.remote && branchRef(b).startsWith(r.name + '/'));
            const filtered = q ? remoteBranches.filter(b => branchDisplay(b, r.name).toLowerCase().includes(q)) : remoteBranches;
            return (
              <div key={r.name}>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{r.name}</div>
                {filtered.map(b => (
                  <SidebarRow
                    key={b.name}
                    label={branchDisplay(b, r.name)}
                    onClick={() => repo && void run('checkout', () => gitService.checkoutBranch(repo, branchRef(b)))}
                    onContextMenu={event => { event.preventDefault(); setBranchMenu({ x: event.clientX, y: event.clientY, branch: b }); }}
                  />
                ))}
              </div>
            );
          })
        }
      </Section>

      {/* Tags — bounded height */}
      <Section icon={<Tag size={15} />} title="Tags" count={tags.length} defaultOpen={false} maxHeight={180} searchable color="#f59e0b">
        {q => {
          const filtered = q ? tags.filter(t => t.name.toLowerCase().includes(q)) : tags;
          return filtered.length === 0
            ? <div className="px-3 py-1 text-[11px] text-slate-500">{q ? 'No matches' : 'No tags'}</div>
            : filtered.map(t => (
              <SidebarRow
                key={t.name}
                label={t.name}
                onDelete={() => repo && void run('delete tag', () => gitService.deleteTag(repo, t.name))}
              />
            ));
        }}
      </Section>

      {/* Stashes — bounded height */}
      <Section icon={<Archive size={15} />} title="Stashes" count={stashes.length} defaultOpen={false} maxHeight={180} searchable color="#a78bfa"
        headerAction={
          <button
            className="icon-btn h-6 px-1.5 text-[10px]"
            disabled={!repo}
            title="Stash changes"
            onClick={() => repo && void run('stash', () => gitService.createStash(repo, 'GitPilot stash'))}
          >
            <Archive size={11} />
          </button>
        }
      >
        {q => {
          const filtered = q ? stashes.filter(s => (s.message || s.name).toLowerCase().includes(q)) : stashes;
          return filtered.length === 0
            ? <div className="px-3 py-1 text-[11px] text-slate-500">{q ? 'No matches' : 'No stashes'}</div>
            : filtered.map(st => (
              <SidebarRow
                key={st.name}
                label={st.message || st.name}
                onAction={() => repo && void run('pop stash', () => gitService.popStash(repo, st.name))}
                actionIcon={<RotateCcw size={11} />}
                actionTitle="Pop stash"
                onDelete={() => repo && void run('drop stash', () => gitService.dropStash(repo, st.name))}
              />
            ));
        }}
      </Section>

      {(mergeState.isMerging || mergeState.isRebasing) && (
        <div className="shrink-0 border-t border-pilot-line bg-amber-950/40 p-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <GitMerge size={12} />
            {mergeState.isMerging ? 'Merge in progress' : 'Rebase in progress'}
          </div>
          <div className="mt-0.5 text-[11px] text-amber-300/70">
            {mergeState.conflictedFiles.length} conflict{mergeState.conflictedFiles.length !== 1 ? 's' : ''}
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

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  icon, title, count, children, defaultOpen = true, grow = false,
  maxHeight, searchable = false, headerAction, color = '#64748b',
}: {
  icon?: ReactNode;
  title: string;
  count?: number;
  children: (searchText: string) => ReactNode;
  defaultOpen?: boolean;
  grow?: boolean;
  maxHeight?: number;
  searchable?: boolean;
  headerAction?: ReactNode;
  color?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');

  const toggleSearch = () => {
    setShowSearch(v => !v);
    setSearchText('');
  };

  const contentStyle = !grow && maxHeight ? { maxHeight } : undefined;
  const contentClass = grow
    ? 'min-h-0 flex-1 overflow-y-auto'
    : 'overflow-y-auto';

  return (
    <section className={`flex border-b border-pilot-line ${open && grow ? 'min-h-0 flex-1' : 'shrink-0'} flex-col`}>
      {/* Header */}
      <div
        className="flex h-9 shrink-0 items-center gap-0 pr-1 transition-colors"
        style={open ? { backgroundColor: `${color}14`, borderLeft: `2px solid ${color}` } : { borderLeft: '2px solid transparent' }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="flex flex-1 items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors hover:text-slate-200"
          style={{ color: open ? color : '#94a3b8' }}
        >
          <span style={{ color: open ? color : '#64748b' }}>{icon}</span>
          <span className="flex-1 text-left">{title}</span>
          {count !== undefined && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold"
              style={open ? { backgroundColor: `${color}22`, color } : { backgroundColor: '#21262d', color: '#94a3b8' }}
            >{count}</span>
          )}
          <span className="ml-0.5" style={{ color: open ? `${color}99` : '#475569' }}>{open ? '▾' : '▸'}</span>
        </button>
        {open && searchable && (
          <button
            className="icon-btn h-6 w-6 justify-center p-0"
            onClick={toggleSearch}
            title="Filter"
            style={{ color: showSearch ? color : undefined }}
          >
            <Search size={11} />
          </button>
        )}
        {open && headerAction}
      </div>

      {/* Search input */}
      {open && showSearch && (
        <div className="relative shrink-0 px-2 pb-1">
          <Search size={10} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            autoFocus
            className="w-full rounded border border-[#30363d] bg-[#0d1117] py-0.5 pl-6 pr-6 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-pilot-blue"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={`Filter ${title.toLowerCase()}…`}
          />
          {searchText && (
            <button
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              onClick={() => setSearchText('')}
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {open && (
        <div className={contentClass} style={contentStyle}>
          {children(searchText.toLowerCase())}
        </div>
      )}
    </section>
  );
}

// ── SidebarRow ────────────────────────────────────────────────────────────────

function SidebarRow({
  label, title, active, icon, meta, extra, onClick, onContextMenu, onDelete, onAction, actionIcon, actionTitle,
}: {
  label: string;
  title?: string;
  active?: boolean;
  icon?: ReactNode;
  meta?: string;
  extra?: ReactNode;
  onClick?: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
  onDelete?: () => void;
  onAction?: () => void;
  actionIcon?: ReactNode;
  actionTitle?: string;
}) {
  return (
    <div
      className={`group flex cursor-default items-center gap-1.5 px-3 py-[3px] transition-colors hover:bg-[#21262d] ${active ? 'bg-[#21262d]' : ''}`}
      onContextMenu={onContextMenu}
    >
      {icon}
      <button
        className={`min-w-0 flex-1 truncate text-left text-[12px] ${active ? 'font-semibold text-pilot-blue' : 'text-slate-300 hover:text-slate-100'}`}
        title={title ?? label}
        onClick={onClick}
      >
        {label}
      </button>
      {meta && <span className="shrink-0 text-[10px] text-slate-400">{meta}</span>}
      {extra}
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        {onAction && (
          <button
            className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            title={actionTitle}
            onClick={e => { e.stopPropagation(); onAction(); }}
          >
            {actionIcon}
          </button>
        )}
        {onDelete && (
          <button
            className="rounded p-0.5 text-slate-400 hover:bg-red-900/60 hover:text-red-400"
            title="Delete"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
