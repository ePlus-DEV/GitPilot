import { MessageSquareText } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function AiPanel() {
  const s = useGitStore();
  const repo = s.repo?.path;

  return (
    <div className="border-t border-pilot-line px-3 py-2">
      <button
        className="icon-btn"
        title="Explain selected diff"
        disabled={!repo || !s.diff}
        onClick={() => repo && s.diff && gitService.explainDiff(repo, s.diff.patch, s.settings?.aiProvider || 'ollama', s.settings?.aiModel || '').then(r => useGitStore.setState({ aiText: r.text }))}
      >
        <MessageSquareText size={13} />
        <span>Explain diff</span>
      </button>
      {s.aiText && (
        <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-pilot-line bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-300">
          {s.aiText}
        </pre>
      )}
    </div>
  );
}
