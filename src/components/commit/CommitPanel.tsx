import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function CommitPanel() {
  const [msg, setMsg] = useState('');
  const [amend, setAmend] = useState(false);
  const s = useGitStore();
  const repo = s.repo?.path;

  const commit = () => {
    if (!repo) return;
    if (!msg.trim()) {
      s.log('Commit message is required');
      return;
    }
    if (!s.status.staged.length) {
      s.log('No staged files to commit');
      return;
    }
    void s.run('commit', () => gitService.commit(repo, msg, amend)).then(() => setMsg(''));
  };

  useEffect(() => {
    const h = () => commit();
    document.addEventListener('gitpilot-commit', h);
    return () => document.removeEventListener('gitpilot-commit', h);
  });

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
          onClick={() => repo && gitService.generateCommitMessage(repo, s.settings?.aiProvider || 'ollama', s.settings?.aiModel || '').then(r => setMsg(r.text.split('\n').pop() || r.text))}
        >
          <Sparkles size={13} />
          <span>AI</span>
        </button>
      </div>
    </div>
  );
}
