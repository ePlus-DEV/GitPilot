import { useEffect } from 'react';

export type ContextMenuItem = {
  label: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type Props = {
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu({ x, y, title, items, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 w-56 overflow-hidden rounded border border-pilot-line bg-[#151b2a] py-1 text-xs text-slate-200 shadow-2xl"
      style={{ left: Math.min(x, window.innerWidth - 236), top: Math.min(y, window.innerHeight - 320) }}
      onMouseDown={event => event.stopPropagation()}
    >
      {title && <div className="border-b border-pilot-line px-3 py-2 font-semibold text-slate-400">{title}</div>}
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          className={`block w-full px-3 py-2 text-left hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 ${item.danger ? 'text-red-300 hover:bg-red-950/60' : ''}`}
          disabled={item.disabled}
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
