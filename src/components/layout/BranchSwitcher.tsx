import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Cloud, GitBranch, Monitor, Search } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { BranchInfo } from '../../types/git';

export function BranchSwitcher() {
  const repo = useGitStore(s => s.repo);
  const status = useGitStore(s => s.status);
  const branches = useGitStore(s => s.branches);
  const run = useGitStore(s => s.run);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const branch = status.currentBranch || repo?.currentBranch || 'no branch';
  const ahead = status.ahead ?? 0;
  const behind = status.behind ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const q = search.toLowerCase();
  const filtered = branches.filter(b => b.name.toLowerCase().includes(q));
  const local = filtered.filter(b => !b.remote);
  const remote = filtered.filter(b => b.remote);

  const checkout = (b: BranchInfo) => {
    if (!repo || b.current) return;
    void run('checkout', () => gitService.checkoutBranch(repo.path, b.name));
    setOpen(false);
    setSearch('');
  };

  if (!repo) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded border border-pilot-line bg-[#21262d] px-2.5 py-1 text-xs transition-colors hover:border-[#484f58]"
        title={branch}
      >
        <GitBranch size={12} className="shrink-0 text-pilot-blue" />
        <span className="max-w-[260px] truncate font-medium">{branch}</span>
        {behind > 0 && <span className="text-[10px] text-amber-400">↓{behind}</span>}
        {ahead > 0 && <span className="text-[10px] text-emerald-400">↑{ahead}</span>}
        <ChevronDown size={11} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[260px] max-w-[480px] overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/60" style={{ width: 'max-content' }}>
          <div className="border-b border-[#21262d] p-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter branches…"
                className="h-8 w-full rounded bg-[#21262d] pl-8 pr-3 text-xs text-slate-200 placeholder-slate-600 outline-none focus:ring-1 focus:ring-pilot-blue/50"
              />
            </div>
          </div>

          <div className="max-h-[380px] overflow-auto p-1">
            {local.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Monitor size={10} />
                  Local
                </div>
                {local.map(b => <BranchRow key={b.name} branch={b} onSelect={() => checkout(b)} />)}
              </>
            )}
            {remote.length > 0 && (
              <>
                <div className="mt-1 flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Cloud size={10} />
                  Remote
                </div>
                {remote.map(b => <BranchRow key={b.name} branch={b} onSelect={() => checkout(b)} />)}
              </>
            )}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">No branches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchRow({ branch, onSelect }: { branch: BranchInfo; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      disabled={branch.current}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
        branch.current
          ? 'bg-[#21262d] text-slate-100 cursor-default'
          : 'text-slate-400 hover:bg-[#21262d] hover:text-slate-200'
      }`}
    >
      <GitBranch size={11} className={branch.current ? 'text-pilot-blue shrink-0' : 'text-slate-500 shrink-0'} />
      <span className="min-w-0 flex-1 break-all leading-snug">{branch.name}</span>
      {branch.ahead > 0 && <span className="text-[10px] text-emerald-400">↑{branch.ahead}</span>}
      {branch.behind > 0 && <span className="text-[10px] text-amber-400">↓{branch.behind}</span>}
      {branch.current && <Check size={11} className="shrink-0 text-pilot-blue" />}
    </button>
  );
}
