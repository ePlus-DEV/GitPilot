import { useState, type ReactNode } from 'react';
import { GitBranch, Globe, Tag, Archive, FolderGit2, Plus, Trash2, GitMerge, RotateCcw } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function Sidebar() {
  const recent = useGitStore(s => s.recent);
  const repoInfo = useGitStore(s => s.repo);
  const branches = useGitStore(s => s.branches);
  const remotes = useGitStore(s => s.remotes);
  const tags = useGitStore(s => s.tags);
  const stashes = useGitStore(s => s.stashes);
  const mergeState = useGitStore(s => s.status.mergeState);
  const openRepo = useGitStore(s => s.openRepo);
  const run = useGitStore(s => s.run);
  const [newBranch, setNewBranch] = useState('');
  const repo = repoInfo?.path;

  return (
    <aside className="w-60 shrink-0 flex flex-col overflow-hidden border-r border-pilot-line bg-[#0a0f1e]">
      <div className="overflow-auto flex-1 py-2">

        {/* Recent Repos */}
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
                onDelete={() => void gitService.removeRecentRepository(r).then(recent => useGitStore.setState({ recent }))}
              />
            ))
          }
        </Section>

        {/* LOCAL Branches */}
        <Section icon={<GitBranch size={13} />} title="Local Branches">
          <div className="flex gap-1 px-2 pb-1">
            <input
              className="input flex-1 text-[11px] h-6 px-1.5"
              value={newBranch}
              onChange={e => setNewBranch(e.target.value)}
              placeholder="new branch…"
              onKeyDown={e => {
                if (e.key === 'Enter' && newBranch && repo) {
                  void run('create branch', () => gitService.createBranch(repo, newBranch, true));
                  setNewBranch('');
                }
              }}
            />
            <button
              className="icon-btn h-6 w-6 p-0 flex items-center justify-center"
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
              icon={b.current ? <span className="w-1.5 h-1.5 rounded-full bg-pilot-blue shrink-0" /> : undefined}
              onClick={() => repo && void run('checkout', () => gitService.checkoutBranch(repo, b.name))}
              onDelete={() => repo && void run('delete branch', () => gitService.deleteBranch(repo, b.name, false))}
              meta={b.ahead || b.behind ? `↑${b.ahead} ↓${b.behind}` : undefined}
            />
          ))}
        </Section>

        {/* Remote Branches */}
        <Section icon={<Globe size={13} />} title="Remotes">
          {remotes.map(r => (
            <div key={r.name}>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">{r.name}</div>
              {branches.filter(b => b.remote && b.name.startsWith(r.name + '/')).map(b => (
                <SidebarRow
                  key={b.name}
                  label={b.name.replace(r.name + '/', '')}
                  onClick={() => repo && void run('checkout', () => gitService.checkoutBranch(repo, b.name))}
                />
              ))}
            </div>
          ))}
          {remotes.length === 0 && <div className="px-3 py-1 text-[11px] text-slate-600">No remotes</div>}
        </Section>

        {/* Tags */}
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

        {/* Stashes */}
        <Section icon={<Archive size={13} />} title="Stashes">
          <div className="px-2 pb-1">
            <button
              className="icon-btn w-full justify-center text-[11px] h-6"
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

      {/* Merge / Rebase state indicator */}
      {(mergeState.isMerging || mergeState.isRebasing) && (
        <div className="shrink-0 border-t border-pilot-line p-2 bg-amber-950/40">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
            <GitMerge size={12} />
            {mergeState.isMerging ? 'Merge in progress' : 'Rebase in progress'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {mergeState.conflictedFiles.length} conflict(s)
          </div>
        </div>
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
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold hover:text-slate-300 transition-colors"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <span className="text-slate-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-0.5 pb-1">{children}</div>}
    </section>
  );
}

function SidebarRow({
  label, title, active, icon, meta, onClick, onDelete, onAction, actionIcon, actionTitle,
}: {
  label: string;
  title?: string;
  active?: boolean;
  icon?: ReactNode;
  meta?: string;
  onClick?: () => void;
  onDelete?: () => void;
  onAction?: () => void;
  actionIcon?: ReactNode;
  actionTitle?: string;
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 px-3 py-1 rounded-none hover:bg-slate-800/60 cursor-default ${active ? 'bg-slate-800/80' : ''}`}
    >
      {icon}
      <button
        className={`min-w-0 flex-1 truncate text-left text-[12px] ${active ? 'text-pilot-blue font-semibold' : 'text-slate-300'}`}
        title={title ?? label}
        onClick={onClick}
      >
        {label}
      </button>
      {meta && <span className="text-[10px] text-slate-500 shrink-0">{meta}</span>}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        {onAction && (
          <button
            className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            title={actionTitle}
            onClick={onAction}
          >
            {actionIcon}
          </button>
        )}
        {onDelete && (
          <button
            className="p-0.5 rounded hover:bg-red-900/60 text-slate-400 hover:text-red-400"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
