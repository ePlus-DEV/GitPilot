import { CalendarDays, Check, Columns2, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLayoutStore, type ColumnConfig } from '../../store/layoutStore';
import type { HistoryFilters } from '../../types/git';

const COLUMN_LABELS: { key: keyof ColumnConfig; label: string }[] = [
  { key: 'branch', label: 'Branch / Tag' },
  { key: 'graph', label: 'Graph' },
  { key: 'message', label: 'Commit Message' },
  { key: 'changes', label: 'Changes' },
  { key: 'author', label: 'Author' },
  { key: 'date', label: 'Date / Time' },
  { key: 'sha', label: 'SHA' },
];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-[#21262d]"
      onClick={() => onChange(!checked)}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
          checked ? 'border-sky-500 bg-sky-500' : 'border-slate-600 bg-transparent'
        }`}
      >
        {checked && <Check size={9} strokeWidth={3} className="text-white" />}
      </span>
      {label}
    </button>
  );
}

export function ColumnConfigMenu({
  onClose,
  filters,
  onFiltersChange,
  hasActiveFilter,
  onClearFilters,
  minDate,
  maxDate,
}: {
  onClose: () => void;
  filters: HistoryFilters;
  onFiltersChange: (f: HistoryFilters) => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const { columns, compactGraph, smartBranch, setColumn, setOption, resetDefault, resetCompact } =
    useLayoutStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const minISO = minDate ? toISO(minDate) : undefined;
  const maxISO = maxDate ? toISO(maxDate) : undefined;
  const hasDateFilter = Boolean(filters.since || filters.until);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-0.5 w-64 rounded border border-pilot-line bg-[#1c2128] py-1 shadow-2xl"
    >
      {/* Date Range */}
      <div className="flex items-center justify-between px-3 pb-0.5 pt-1.5">
        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
          <CalendarDays size={10} />
          Date Range
        </div>
        {hasDateFilter && (
          <button
            className="text-[9px] text-red-400 hover:text-red-300"
            onClick={() => onFiltersChange({ ...filters, since: undefined, until: undefined })}
          >
            clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wide text-slate-600">From</span>
          <input
            className="input w-full text-xs"
            type="date"
            value={filters.since ?? ''}
            min={minISO}
            max={filters.until ?? maxISO}
            onChange={e => onFiltersChange({ ...filters, since: e.target.value || undefined })}
            onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wide text-slate-600">To</span>
          <input
            className="input w-full text-xs"
            type="date"
            value={filters.until ?? ''}
            min={filters.since ?? minISO}
            max={maxISO}
            onChange={e => onFiltersChange({ ...filters, until: e.target.value || undefined })}
            onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </div>
      </div>

      {/* Other filters */}
      <div className="flex flex-col gap-1.5 px-3 pb-2">
        <input
          className="input h-7 w-full text-xs"
          value={filters.keyword ?? ''}
          onChange={e => onFiltersChange({ ...filters, keyword: e.target.value || undefined })}
          placeholder="Message keyword"
        />
        <input
          className="input h-7 w-full text-xs"
          value={filters.filePath ?? ''}
          onChange={e => onFiltersChange({ ...filters, filePath: e.target.value || undefined })}
          placeholder="File path filter"
        />
      </div>

      {hasActiveFilter && (
        <button
          className="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-red-400 hover:bg-[#21262d]"
          onClick={onClearFilters}
        >
          <X size={11} />
          Clear all filters
        </button>
      )}

      <div className="my-1 border-t border-pilot-line" />

      {/* Columns */}
      <SectionLabel>Columns</SectionLabel>
      {COLUMN_LABELS.map(({ key, label }) => (
        <CheckRow key={key} checked={columns[key]} label={label} onChange={v => setColumn(key, v)} />
      ))}

      <div className="my-1 border-t border-pilot-line" />

      {/* Layout */}
      <SectionLabel>Layout</SectionLabel>
      <CheckRow
        checked={compactGraph}
        label="Compact Graph Column"
        onChange={v => setOption('compactGraph', v)}
      />
      <CheckRow
        checked={smartBranch}
        label="Smart Branch Visibility"
        onChange={v => setOption('smartBranch', v)}
      />

      <div className="my-1 border-t border-pilot-line" />

      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-[#21262d] hover:text-slate-300"
        onClick={() => { resetDefault(); onClose(); }}
      >
        <RotateCcw size={11} />
        Reset to default layout
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-[#21262d] hover:text-slate-300"
        onClick={() => { resetCompact(); onClose(); }}
      >
        <Columns2 size={11} />
        Reset to compact layout
      </button>
    </div>
  );
}
