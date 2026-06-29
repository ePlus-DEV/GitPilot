import { MessageSquareText } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function AiPanel() {
  const repo = useGitStore(s => s.repo?.path);
  const diff = useGitStore(s => s.diff);
  const settings = useGitStore(s => s.settings);
  const aiText = useGitStore(s => s.aiText);

  if (!diff && !aiText) return null;

  return (
    <div className="border-t border-pilot-line px-3 py-2">
      <button
        className="icon-btn"
        title="Explain selected diff"
        disabled={!repo || !diff}
        onClick={() => repo && diff && gitService.explainDiff(repo, diff.patch, settings?.aiProvider || 'ollama', settings?.aiModel || '').then(r => useGitStore.setState({ aiText: r.text }))}
      >
        <MessageSquareText size={13} />
        <span>Explain diff</span>
      </button>
      {aiText && (
        <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-pilot-line bg-[#0d1117]/60 p-2 text-xs leading-relaxed text-slate-300">
          {aiText}
        </pre>
      )}
    </div>
  );
}
