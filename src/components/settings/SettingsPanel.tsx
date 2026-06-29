import { useState } from 'react';
import { Bot, ChevronRight, Clock, GitBranch, Info, Settings, Terminal, X } from 'lucide-react';
import { useGitStore, startAutoFetch } from '../../store/gitStore';
import { gitService } from '../../services/gitService';
import type { Settings as SettingsType } from '../../types/git';
import { GitPilotIcon } from '../common/GitPilotIcon';

type Tab = 'general' | 'git' | 'ai' | 'about';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General',  icon: <Settings size={15} /> },
  { id: 'git',     label: 'Git',      icon: <GitBranch size={15} /> },
  { id: 'ai',      label: 'AI',       icon: <Bot size={15} /> },
  { id: 'about',   label: 'About',    icon: <Info size={15} /> },
];

const AUTO_FETCH_OPTIONS = [
  { label: 'Disabled',    value: 0 },
  { label: '30 seconds',  value: 30 },
  { label: '1 minute',    value: 60 },
  { label: '5 minutes',   value: 300 },
  { label: '10 minutes',  value: 600 },
  { label: '30 minutes',  value: 1800 },
];

const AI_PROVIDERS = ['ollama', 'openai', 'anthropic', 'groq'];

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-8 py-4 border-b border-[#21262d] last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{hint}</div>}
      </div>
      <div className="w-[220px] shrink-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-6 first:mt-0 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
      {children}
    </div>
  );
}

export function SettingsPanel() {
  const settings = useGitStore(s => s.settings);
  const [tab, setTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);

  if (!settings) return null;

  const set = (k: keyof SettingsType, v: string | number) =>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[580px] w-[760px] overflow-hidden rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-2xl shadow-black/70">

        {/* Sidebar */}
        <div className="flex w-[180px] shrink-0 flex-col border-r border-[#21262d] bg-[#080d14]">
          <div className="flex h-14 items-center gap-2.5 border-b border-[#21262d] px-4">
            <GitPilotIcon size={22} />
            <span className="text-xs font-bold tracking-wide text-slate-300">
              <span className="font-light text-slate-600">git</span>PILOT
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 p-2">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  tab === t.id
                    ? 'bg-[#21262d] font-medium text-slate-100'
                    : 'text-slate-500 hover:bg-[#161b22] hover:text-slate-300'
                }`}
              >
                <span className={tab === t.id ? 'text-pilot-blue' : 'text-slate-600'}>{t.icon}</span>
                {t.label}
                {tab === t.id && <ChevronRight size={12} className="ml-auto text-slate-600" />}
              </button>
            ))}
          </nav>

          <div className="p-2">
            <div className="rounded-md bg-[#161b22] p-3 text-[10px] leading-relaxed text-slate-600">
              Changes save when you click <span className="text-slate-400">Save Settings</span>.
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-[#21262d] px-6">
            <h2 className="text-base font-semibold text-slate-100">
              {TABS.find(t => t.id === tab)?.label}
            </h2>
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-[#21262d] hover:text-slate-200"
              onClick={() => useGitStore.setState({ settingsOpen: false })}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-auto px-6 py-2">
            {tab === 'general' && (
              <div>
                <SectionTitle>Sync</SectionTitle>
                <FieldRow
                  label="Auto-Fetch Interval"
                  hint="Automatically fetch all remotes in the background."
                >
                  <div className="relative">
                    <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    <select
                      className="input h-9 w-full pl-8 text-sm"
                      value={settings.autoFetchInterval ?? 0}
                      onChange={e => set('autoFetchInterval', Number(e.target.value))}
                    >
                      {AUTO_FETCH_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </FieldRow>

                <SectionTitle>Defaults</SectionTitle>
                <FieldRow
                  label="Default Target Branch"
                  hint="Used as the base branch for PRs and comparisons."
                >
                  <div className="relative">
                    <GitBranch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      className="input h-9 w-full pl-8 text-sm"
                      value={settings.defaultTargetBranch}
                      onChange={e => set('defaultTargetBranch', e.target.value)}
                      placeholder="main"
                    />
                  </div>
                </FieldRow>
              </div>
            )}

            {tab === 'git' && (
              <div>
                <SectionTitle>Executable</SectionTitle>
                <FieldRow
                  label="Git Path"
                  hint="Path to the git binary. Leave as 'git' to use the system default."
                >
                  <div className="relative">
                    <Terminal size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      className="input h-9 w-full pl-8 font-mono text-sm"
                      value={settings.gitPath}
                      onChange={e => set('gitPath', e.target.value)}
                      placeholder="git"
                    />
                  </div>
                </FieldRow>
              </div>
            )}

            {tab === 'ai' && (
              <div>
                <SectionTitle>Provider</SectionTitle>
                <FieldRow label="AI Provider" hint="Service used for commit message generation and diff explanations.">
                  <select
                    className="input h-9 w-full text-sm"
                    value={settings.aiProvider}
                    onChange={e => set('aiProvider', e.target.value)}
                  >
                    {AI_PROVIDERS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </FieldRow>

                <SectionTitle>Credentials</SectionTitle>
                <FieldRow label="API Key" hint="Leave blank for local providers like Ollama.">
                  <input
                    className="input h-9 w-full font-mono text-sm"
                    type="password"
                    value={settings.aiApiKey}
                    onChange={e => set('aiApiKey', e.target.value)}
                    placeholder="sk-…"
                  />
                </FieldRow>

                <SectionTitle>Model</SectionTitle>
                <FieldRow label="Model" hint="Model identifier to use for requests.">
                  <input
                    className="input h-9 w-full font-mono text-sm"
                    value={settings.aiModel}
                    onChange={e => set('aiModel', e.target.value)}
                    placeholder="llama3, gpt-4o, claude-sonnet-4-6…"
                  />
                </FieldRow>
              </div>
            )}

            {tab === 'about' && (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <GitPilotIcon size={64} />
                <div className="mt-5 text-2xl font-light text-slate-100">
                  <span className="text-slate-500">git</span>
                  <span className="font-bold">PILOT</span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-600">Visual Git Client</div>
                <div className="mt-6 text-xs text-slate-600">Built with Tauri 2 · React 18 · Rust</div>
                <div className="mt-1 text-[11px] text-slate-700">© 2026 RiverCrane Vietnam</div>
              </div>
            )}
          </div>

          {/* Footer */}
          {tab !== 'about' && (
            <div className="flex items-center justify-end gap-3 border-t border-[#21262d] px-6 py-4">
              <button
                type="button"
                className="rounded-md px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
                onClick={() => useGitStore.setState({ settingsOpen: false })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-5 py-2 text-sm"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
