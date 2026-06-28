import { X } from 'lucide-react';
import { useGitStore } from '../../store/gitStore';
import { gitService } from '../../services/gitService';

export function SettingsPanel() {
  const settings = useGitStore(s => s.settings);
  if (!settings) return null;

  const set = (k: keyof typeof settings, v: string) => useGitStore.setState({ settings: { ...settings, [k]: v } });

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#080d19] shadow-2xl shadow-black/50">
      <div className="flex h-12 items-center justify-between border-b border-pilot-line px-3">
        <h3 className="text-sm font-semibold text-slate-100">Settings</h3>
        <button className="icon-btn h-8 w-8 justify-center p-0" title="Close settings" onClick={() => useGitStore.setState({ settingsOpen: false })}>
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {(['theme', 'gitPath', 'defaultTargetBranch', 'aiProvider', 'aiApiKey', 'aiModel'] as const).map(k => (
          <label className="mb-3 block text-xs text-slate-400" key={k}>
            <span className="mb-1 block">{k}</span>
            <input className="input h-8 w-full text-xs" value={settings[k]} onChange={e => set(k, e.target.value)} />
          </label>
        ))}
      </div>

      <div className="border-t border-pilot-line p-3">
        <button
          className="btn-primary w-full"
          onClick={() => gitService.saveSettings(settings).then(saved => useGitStore.setState({ settings: saved, settingsOpen: false }))}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
