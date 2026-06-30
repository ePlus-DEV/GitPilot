import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type PromptReq  = { type: 'prompt';  message: string; defaultValue?: string; resolve: (v: string | null) => void };
type ConfirmReq = { type: 'confirm'; message: string; danger?: boolean;       resolve: (v: boolean) => void };
type AlertReq   = { type: 'alert';   message: string;                          resolve: () => void };
type DialogReq  = PromptReq | ConfirmReq | AlertReq;

// ── Module-level queue ───────────────────────────────────────────────────────

let _enqueue: ((req: DialogReq) => void) | null = null;

function enqueue(req: DialogReq) {
  if (_enqueue) {
    _enqueue(req);
  } else {
    // Host not mounted — fall back to native
    if (req.type === 'prompt')  req.resolve(window.prompt(req.message, req.defaultValue ?? '') ?? null);
    else if (req.type === 'confirm') req.resolve(window.confirm(req.message));
    else req.resolve();
  }
}

export const gpPrompt = (message: string, defaultValue = ''): Promise<string | null> =>
  new Promise(resolve => enqueue({ type: 'prompt', message, defaultValue, resolve }));

export const gpConfirm = (message: string, danger = false): Promise<boolean> =>
  new Promise(resolve => enqueue({ type: 'confirm', message, danger, resolve }));

export const gpAlert = (message: string): Promise<void> =>
  new Promise(resolve => enqueue({ type: 'alert', message, resolve }));

// ── Host component ───────────────────────────────────────────────────────────

export function DialogHost() {
  const [queue, setQueue] = useState<DialogReq[]>([]);

  useEffect(() => {
    _enqueue = req => setQueue(q => [...q, req]);
    return () => { _enqueue = null; };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const dismiss = () => setQueue(q => q.slice(1));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      {current.type === 'prompt'  && <PromptDialog  req={current} onDone={dismiss} />}
      {current.type === 'confirm' && <ConfirmDialog req={current} onDone={dismiss} />}
      {current.type === 'alert'   && <AlertDialog   req={current} onDone={dismiss} />}
    </div>
  );
}

// ── Shared shell ─────────────────────────────────────────────────────────────

function Shell({ title, icon, children, onClose }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className="w-[420px] overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/80"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#21262d] bg-[#0d1117] px-4 py-3">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="flex-1 text-sm font-semibold text-slate-200">{title}</span>
        {onClose && (
          <button className="rounded p-0.5 text-slate-500 hover:bg-[#21262d] hover:text-slate-300" onClick={onClose}>
            <X size={14} />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Prompt ───────────────────────────────────────────────────────────────────

function PromptDialog({ req, onDone }: { req: PromptReq; onDone: () => void }) {
  const [value, setValue] = useState(req.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const ok = () => { req.resolve(value.trim() || null); onDone(); };
  const cancel = () => { req.resolve(null); onDone(); };

  return (
    <Shell title="GitPilot" onClose={cancel}>
      <p className="mb-3 text-sm text-slate-300">{req.message}</p>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); }}
        className="mb-4 w-full rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-pilot-blue focus:ring-1 focus:ring-pilot-blue/20"
      />
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={cancel}>Cancel</button>
        <button className="btn-primary px-4 py-1.5 text-xs" onClick={ok}>OK</button>
      </div>
    </Shell>
  );
}

// ── Confirm ──────────────────────────────────────────────────────────────────

function ConfirmDialog({ req, onDone }: { req: ConfirmReq; onDone: () => void }) {
  const ok = () => { req.resolve(true); onDone(); };
  const cancel = () => { req.resolve(false); onDone(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Shell
      title={req.danger ? 'Confirm destructive action' : 'Confirm'}
      icon={req.danger
        ? <AlertTriangle size={16} className="text-red-400" />
        : <Info size={16} className="text-pilot-blue" />}
      onClose={cancel}
    >
      <p className="mb-4 text-sm text-slate-300">{req.message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={cancel}>Cancel</button>
        <button
          autoFocus
          className={req.danger
            ? 'rounded border border-red-800/60 bg-red-950/50 px-4 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900/60'
            : 'btn-primary px-4 py-1.5 text-xs'}
          onClick={ok}
        >
          {req.danger ? 'Yes, proceed' : 'Confirm'}
        </button>
      </div>
    </Shell>
  );
}

// ── Alert ────────────────────────────────────────────────────────────────────

function AlertDialog({ req, onDone }: { req: AlertReq; onDone: () => void }) {
  const ok = () => { req.resolve(); onDone(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'Escape') ok(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Shell title="GitPilot" icon={<Info size={16} className="text-pilot-blue" />}>
      <p className="mb-4 text-sm text-slate-300">{req.message}</p>
      <div className="flex justify-end">
        <button autoFocus className="btn-primary px-4 py-1.5 text-xs" onClick={ok}>OK</button>
      </div>
    </Shell>
  );
}
