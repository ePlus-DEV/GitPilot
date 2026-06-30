import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function CommitPanel() {
  const [msg, setMsg] = useState('');
  const [amend, setAmend] = useState(false);
  const repo = useGitStore(s => s.repo?.path);
  const stagedCount = useGitStore(s => s.status.staged.length);
  const settings = useGitStore(s => s.settings);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);

  const commit = useCallback(() => {
    if (!repo) return;
    if (!msg.trim()) { log('Commit message required'); return; }
    if (!stagedCount && !amend) { log('No staged files'); return; }
    void run('commit', () => gitService.commit(repo, msg, amend)).then(() => setMsg(''));
  }, [amend, log, msg, repo, run, stagedCount]);

  useEffect(() => {
    const h = () => commit();
    document.addEventListener('gitpilot-commit', h);
    return () => document.removeEventListener('gitpilot-commit', h);
  }, [commit]);

  const generateMessage = () => {
    if (!repo) return;
    void gitService
      .generateCommitMessage(repo, settings?.aiProvider || 'ollama', settings?.aiModel || '')
      .then(r => setMsg(r.text.split('\n').pop() || r.text));
  };

  return (
    <div className="shrink-0 border-t border-pilot-line bg-pilot-panel p-2.5">
      {/* Textarea + Generate button */}
      <div className="relative mb-2">
        <textarea
          className="input h-[72px] w-full resize-none pr-[72px] text-xs"
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Commit message (⌘↵ to commit)"
        />
        <button
          className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded border border-[#30363d] bg-[#21262d] px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-[#30363d] hover:text-slate-200"
          title="Generate commit message with AI"
          onClick={generateMessage}
          disabled={!repo}
        >
          <Sparkles size={10} />
          Generate
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          className="flex-1 rounded bg-pilot-blue py-1.5 text-xs font-bold text-slate-950 transition-colors hover:brightness-110 active:brightness-90 disabled:opacity-40"
          onClick={commit}
          disabled={!repo || (!stagedCount && !amend) || !msg.trim()}
          title="Commit staged changes"
        >
          Commit
        </button>
        <button
          className="rounded border border-pilot-line bg-[#21262d] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-[#30363d]"
          title="Commit without running hooks"
          disabled={!repo || (!stagedCount && !amend) || !msg.trim()}
          onClick={() => {
            if (!repo || !msg.trim()) return;
            void run('commit (no hooks)', () => gitService.commit(repo, msg, amend)).then(() => setMsg(''));
          }}
        >
          Safe commit
        </button>
        <button
          className={`rounded border px-3 py-1.5 text-xs transition-colors ${amend ? 'border-pilot-blue bg-teal-900/40 text-pilot-blue' : 'border-pilot-line bg-[#21262d] text-slate-300 hover:bg-[#30363d]'}`}
          onClick={() => setAmend(a => !a)}
          title="Amend last commit"
        >
          Amend
        </button>
      </div>
    </div>
  );
}
