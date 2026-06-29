import { useState } from 'react';
import { X } from 'lucide-react';
import { useGitStore, startAutoFetch } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { Settings } from '../../types/git';

const AUTO_FETCH_OPTIONS = [
  { label: 'Disabled', value: 0 },
  { label: '5 seconds', value: 5 },
  { label: '10 seconds', value: 10 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '30 minutes', value: 1800 },
];

export function SettingsPanel() {
  const settings = useGitStore(s => s.settings);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;

  const set = (k: keyof Settings, v: string | number) =>
    useGitStore.setState({ settings: { ...settings, [k]: v } });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await gitService.saveSettings(settings);
      useGitStore.setState({ settings: saved, settingsOpen: false });
      startAutoFetch(saved.autoFetchInterval);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d1117] shadow-2xl shadow-black/50">
      <div className="flex h-12 items-center justify-between border-b border-pilot-line px-3">
        <h3 className="text-sm font-semibold text-slate-100">Settings</h3>
        <button
          className="icon-btn h-8 w-8 justify-center p-0"
          title="Close settings"
          onClick={() => useGitStore.setState({ settingsOpen: false })}
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 space-y-5">
        {/* General section */}
        <section>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">General</h4>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-300">Auto-Fetch Interval</span>
              <select
                className="input h-8 w-full text-xs"
                value={settings.autoFetchInterval ?? 0}
                onChange={e => set('autoFetchInterval', Number(e.target.value))}
              >
                {AUTO_FETCH_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                Automatically fetch all remotes in the background. Set to Disabled to turn off.
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-300">Default Target Branch</span>
              <input
                className="input h-8 w-full text-xs"
                value={settings.defaultTargetBranch}
                onChange={e => set('defaultTargetBranch', e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-300">Git Executable Path</span>
              <input
                className="input h-8 w-full text-xs font-mono"
                value={settings.gitPath}
                onChange={e => set('gitPath', e.target.value)}
                placeholder="git"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-300">Theme</span>
              <input
                className="input h-8 w-full text-xs"
                value={settings.theme}
                onChange={e => set('theme', e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* AI section */}
        <section>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI</h4>
          <div className="space-y-4">
            {(['aiProvider', 'aiApiKey', 'aiModel'] as const).map(k => (
              <label className="block" key={k}>
                <span className="mb-1.5 block text-xs text-slate-300">{k}</span>
                <input
                  className="input h-8 w-full text-xs"
                  value={settings[k]}
                  onChange={e => set(k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-pilot-line p-3">
        <button className="btn-primary w-full" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
