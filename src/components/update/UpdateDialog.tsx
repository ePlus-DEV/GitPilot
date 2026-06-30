import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ArrowDownToLine, CheckCircle2, Loader2, X } from 'lucide-react';
import { GitPilotIcon } from '../common/GitPilotIcon';

type Status = 'checking' | 'available' | 'latest' | 'downloading' | 'installing' | 'error';

export function UpdateDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>('checking');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    check()
      .then(u => {
        if (u) { setUpdate(u); setStatus('available'); }
        else setStatus('latest');
      })
      .catch(e => { setError(String(e)); setStatus('error'); });
  }, []);

  const handleInstall = async () => {
    if (!update) return;
    setStatus('downloading');
    try {
      await update.downloadAndInstall(event => {
        if (event.event === 'Started') {
          setTotal(event.data.contentLength ?? 0);
        } else if (event.event === 'Progress') {
          setDownloaded(d => {
            const next = d + event.data.chunkLength;
            if (total > 0) setProgress(Math.round((next / total) * 100));
            return next;
          });
        } else if (event.event === 'Finished') {
          setStatus('installing');
        }
      });
      await relaunch();
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl shadow-black/70">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#21262d] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <GitPilotIcon size={20} />
            <span className="text-sm font-semibold text-slate-200">Check for Update</span>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-[#21262d] hover:text-slate-200"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={28} className="animate-spin text-pilot-blue" />
              <p className="text-sm text-slate-400">Checking for updates…</p>
            </div>
          )}

          {status === 'latest' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-sm font-medium text-slate-200">You're up to date!</p>
              <p className="text-xs text-slate-600">GitPilot is running the latest version.</p>
            </div>
          )}

          {status === 'available' && update && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-pilot-blue/10 px-4 py-3">
                <ArrowDownToLine size={18} className="shrink-0 text-pilot-blue" />
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    Version {update.version} available
                  </div>
                  <div className="text-xs text-slate-500">A new version of GitPilot is ready to install.</div>
                </div>
              </div>
              {update.body && (
                <div className="max-h-40 overflow-auto rounded border border-[#21262d] bg-[#080d14] px-4 py-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{update.body}</p>
                </div>
              )}
            </div>
          )}

          {status === 'downloading' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Downloading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#21262d]">
                <div
                  className="h-full rounded-full bg-pilot-blue transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {total > 0 && (
                <p className="text-center text-[11px] text-slate-600">
                  {(downloaded / 1024 / 1024).toFixed(1)} / {(total / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
            </div>
          )}

          {status === 'installing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={28} className="animate-spin text-pilot-blue" />
              <p className="text-sm text-slate-400">Installing update… App will restart.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm font-medium text-red-400">Update failed</p>
              <p className="rounded bg-[#080d14] px-3 py-2 font-mono text-[11px] text-slate-500">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#21262d] px-5 py-3">
          <button className="btn" onClick={onClose} disabled={status === 'downloading' || status === 'installing'}>
            {status === 'latest' || status === 'error' ? 'Close' : 'Cancel'}
          </button>
          {status === 'available' && (
            <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => void handleInstall()}>
              Install & Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
