import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ColumnConfig {
  branch: boolean;
  graph: boolean;
  message: boolean;
  changes: boolean;
  author: boolean;
  date: boolean;
  sha: boolean;
}

interface LayoutState {
  columns: ColumnConfig;
  compactGraph: boolean;
  smartBranch: boolean;
  setColumn: (col: keyof ColumnConfig, value: boolean) => void;
  setOption: (opt: 'compactGraph' | 'smartBranch', value: boolean) => void;
  resetDefault: () => void;
  resetCompact: () => void;
}

const DEFAULT_COLUMNS: ColumnConfig = {
  branch: true,
  graph: true,
  message: true,
  changes: true,
  author: true,
  date: true,
  sha: true,
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      columns: { ...DEFAULT_COLUMNS },
      compactGraph: false,
      smartBranch: true,
      setColumn: (col, value) => set(s => ({ columns: { ...s.columns, [col]: value } })),
      setOption: (opt, value) => set({ [opt]: value }),
      resetDefault: () => set({ columns: { ...DEFAULT_COLUMNS }, compactGraph: false, smartBranch: true }),
      resetCompact: () => set({ columns: { ...DEFAULT_COLUMNS }, compactGraph: true, smartBranch: true }),
    }),
    { name: 'gitpilot-layout' },
  ),
);
