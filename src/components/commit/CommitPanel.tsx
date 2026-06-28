import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function CommitPanel() {
  const [msg, setMsg] = useState('');
  const [amend, setAmend] = useState(false);
  const repo = useGitStore(s => s.repo?.path);
  const stagedCount = useGitStore(s => s.status.staged.length);
  const changedCount = useGitStore(s => s.status.staged.length + s.status.unstaged.length + s.status.untracked.length + s.status.conflicted.length);
  const settings = useGitStore(s => s.settings);
  const run = useGitStore(s => s.run);
  const log = useGitStore(s => s.log);

  const commit = useCallback(() => {
    if (!repo) return;
    if (!msg.trim()) {
      log('Commit message is required');
      return;
    }
    if (!stagedCount) {
      log('No staged files to commit');
      return;
    }
    void run('commit', () => gitService.commit(repo, msg, amend)).then(() => setMsg(''));
  }, [amend, log, msg, repo, run, stagedCount]);

  useEffect(() => {
    const h = () => commit();
    document.addEventListener('gitpilot-commit', h);
    return () => document.removeEventListener('gitpilot-commit', h);
  }, [commit]);

  if (changedCount === 0) return null;

  return (
    <div className="p-3">
      <textarea
        className="input h-16 w-full resize-none text-xs"
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="Commit message"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="mr-auto flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={amend} onChange={e => setAmend(e.target.checked)} />
          Amend
        </label>
        <button className="btn-primary" onClick={commit}>Commit</button>
        <button
          className="icon-btn"
          title="Generate commit message"
          onClick={() => repo && gitService.generateCommitMessage(repo, settings?.aiProvider || 'ollama', settings?.aiModel || '').then(r => setMsg(r.text.split('\n').pop() || r.text))}
        >
          <Sparkles size={13} />
          <span>AI</span>
        </button>
      </div>
    </div>
  );
}
