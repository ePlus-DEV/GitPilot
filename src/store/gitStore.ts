import { create } from 'zustand';
import { gitService } from '../services/gitService';

let _autoFetchTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoFetch(intervalSeconds: number) {
  if (_autoFetchTimer) { clearInterval(_autoFetchTimer); _autoFetchTimer = null; }
  if (intervalSeconds <= 0) return;
  _autoFetchTimer = setInterval(async () => {
    const { repo, fetchAll } = useGitStore.getState();
    if (repo) await fetchAll();
  }, intervalSeconds * 1000);
}

export function stopAutoFetch() {
  if (_autoFetchTimer) { clearInterval(_autoFetchTimer); _autoFetchTimer = null; }
}
import type {
  BranchInfo,
  CommitFile,
  CommitGraphRow,
  CommitInfo,
  DiffResult,
  GitCommandOutput,
  GitFileStatus,
  GitStatus,
  HistoryFilters,
  ParsedConflictFile,
  RemoteInfo,
  RepositoryInfo,
  Settings,
  StashInfo,
  TagInfo,
} from '../types/git';

const empty: GitStatus = {
  currentBranch: '',
  staged: [],
  unstaged: [],
  untracked: [],
  conflicted: [],
  ahead: 0,
  behind: 0,
  mergeState: { isMerging: false, isRebasing: false, conflictedFiles: [] },
};

type RefreshMode = 'full' | 'status' | 'none';

type State = {
  repo?: RepositoryInfo;
  recent: string[];
  status: GitStatus;
  branches: BranchInfo[];
  remotes: RemoteInfo[];
  history: CommitInfo[];
  graphData: CommitGraphRow[];
  commitFiles: CommitFile[];
  commitFilesLoading: boolean;
  commitFilesError?: string;
  stashes: StashInfo[];
  tags: TagInfo[];
  selectedFile?: GitFileStatus;
  selectedCommit?: CommitInfo;
  diff?: DiffResult;
  conflict?: ParsedConflictFile;
  settings?: Settings;
  settingsOpen: boolean;
  settingsTab: string;
  repoMgmtOpen: boolean;
  rightPanelTab: 'working' | 'review';
  console: string[];
  problems: string[];
  aiText: string;
  busy: boolean;
  historyLimit: number;
  historyFilters: HistoryFilters;
  openRepo: (path: string) => Promise<void>;
  closeRepo: () => void;
  refresh: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  loadHistory: (filters?: HistoryFilters, limit?: number) => Promise<void>;
  loadGraphData: (filters?: HistoryFilters, limit?: number) => Promise<void>;
  run: (label: string, fn: () => Promise<GitCommandOutput | GitCommandOutput[] | string | unknown>, refreshMode?: RefreshMode) => Promise<void>;
  fetchAll: () => Promise<void>;
  setSelectedFile: (f: GitFileStatus, cached: boolean) => Promise<void>;
  selectCommit: (c: CommitInfo) => Promise<void>;
  loadConflict: (path: string) => Promise<void>;
  log: (m: string) => void;
};

const fmt = (r: unknown): string =>
  Array.isArray(r)
    ? r.map(fmt).join('\n')
    : typeof r === 'object' && r && 'command' in r
      ? `$ ${(r as GitCommandOutput).command}\n${(r as GitCommandOutput).stdout}${(r as GitCommandOutput).stderr}`
      : String(r);

export const useGitStore = create<State>((set, get) => ({
  recent: [],
  status: empty,
  branches: [],
  remotes: [],
  history: [],
  graphData: [],
  commitFiles: [],
  commitFilesLoading: false,
  commitFilesError: undefined,
  stashes: [],
  tags: [],
  settingsOpen: false,
  settingsTab: 'general',
  repoMgmtOpen: false,
  rightPanelTab: 'working',
  console: [],
  problems: [],
  aiText: '',
  busy: false,
  historyLimit: 500,
  historyFilters: {},

  log: m => set(s => ({ console: [m, ...s.console].slice(0, 100) })),

  openRepo: async path => {
    set({
      busy: true,
      repo: undefined,
      status: empty,
      branches: [],
      remotes: [],
      history: [],
      graphData: [],
      commitFiles: [],
      commitFilesLoading: false,
      commitFilesError: undefined,
      stashes: [],
      tags: [],
      selectedFile: undefined,
      selectedCommit: undefined,
      diff: undefined,
      conflict: undefined,
      aiText: '',
    });
    try {
      const repo = await gitService.openRepository(path);
      await gitService.saveRecentRepository(path);
      set({ repo });
      await get().refresh();
      // Background fetch — updates remote tracking refs silently after initial load
      void gitService.fetchAll(path).then(() => get().refresh()).catch(() => {});
      const interval = get().settings?.autoFetchInterval ?? 0;
      startAutoFetch(interval);
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    } finally {
      set({ busy: false });
    }
  },

  closeRepo: () => {
    stopAutoFetch();
    set({
      repo: undefined,
      status: empty,
      branches: [],
      remotes: [],
      history: [],
      graphData: [],
      commitFiles: [],
      commitFilesLoading: false,
      commitFilesError: undefined,
      stashes: [],
      tags: [],
      selectedFile: undefined,
      selectedCommit: undefined,
      diff: undefined,
      conflict: undefined,
      aiText: '',
      busy: false,
      historyFilters: {},
    });
  },

  refresh: async () => {
    const repo = get().repo;
    if (!repo) return;
    set({ busy: true });
    try {
      const filters = get().historyFilters;
      const limit = get().historyLimit;
      const [status, branches, remotes, history, graphData, stashes, tags, recent, settings] = await Promise.all([
        gitService.getStatus(repo.path),
        gitService.listBranches(repo.path),
        gitService.listRemotes(repo.path),
        gitService.getHistory(repo.path, limit, filters),
        gitService.getCommitGraph(repo.path, limit, filters.branch, true).catch(() => [] as import('../types/git').CommitGraphRow[]),
        gitService.listStashes(repo.path),
        gitService.listTags(repo.path),
        gitService.listRecentRepositories(),
        gitService.getSettings(),
      ]);
      set({ status, branches, remotes, history, graphData, stashes, tags, recent, settings, repo: { ...repo, currentBranch: status.currentBranch } });
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    } finally {
      set({ busy: false });
    }
  },

  refreshStatus: async () => {
    const repo = get().repo;
    if (!repo) return;
    try {
      const status = await gitService.getStatus(repo.path);
      set({ status, repo: { ...repo, currentBranch: status.currentBranch } });
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    }
  },

  loadHistory: async (filters, limit) => {
    const repo = get().repo;
    if (!repo) return;
    const nextFilters = filters ?? get().historyFilters;
    const nextLimit = limit ?? get().historyLimit;
    set({ busy: true, historyFilters: nextFilters, historyLimit: nextLimit });
    try {
      const [history, graphData] = await Promise.all([
        gitService.getHistory(repo.path, nextLimit, nextFilters),
        gitService.getCommitGraph(repo.path, nextLimit, nextFilters.branch, true).catch(() => [] as import('../types/git').CommitGraphRow[]),
      ]);
      set({ history, graphData });
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    } finally {
      set({ busy: false });
    }
  },

  loadGraphData: async (filters, limit) => {
    const repo = get().repo;
    if (!repo) return;
    const nextFilters = filters ?? get().historyFilters;
    const nextLimit = limit ?? get().historyLimit;
    try {
      const graphData = await gitService.getCommitGraph(repo.path, nextLimit, nextFilters.branch, true);
      set({ graphData });
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    }
  },

  run: async (label, fn, refreshMode = 'full') => {
    try {
      const r = await fn();
      get().log(`${label}\n${fmt(r)}`);
      if (refreshMode === 'status') await get().refreshStatus();
      else if (refreshMode === 'full') await get().refresh();
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    }
  },

  setSelectedFile: async (f, cached) => {
    const repo = get().repo;
    if (!repo) return;
    set({ selectedFile: f, diff: undefined });
    try {
      set({ diff: await gitService.getDiff(repo.path, f.path, cached) });
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    }
  },

  selectCommit: async c => {
    const repo = get().repo;
    if (!repo) return;
    const hash = c.hash.trim() || c.shortHash.trim();
    if (!hash) {
      get().log('Cannot load commit details: empty commit hash.');
      return;
    }
    const commit = { ...c, hash };
    set({ selectedCommit: commit, commitFiles: [], commitFilesLoading: true, commitFilesError: undefined, selectedFile: undefined, diff: undefined, conflict: undefined });
    try {
      const files = await gitService.getCommitFiles(repo.path, hash);
      if (get().selectedCommit?.hash === hash) set({ commitFiles: files });
    } catch (e) {
      const message = String((e as Error).message ?? e);
      if (get().selectedCommit?.hash === hash) set({ commitFilesError: message });
      get().log(message);
    } finally {
      if (get().selectedCommit?.hash === hash) set({ commitFilesLoading: false });
    }
  },

  fetchAll: async () => {
    const repo = get().repo;
    if (!repo) return;
    try {
      await gitService.fetchAll(repo.path);
      await get().refresh();
    } catch (e) {
      get().log(String((e as Error).message ?? e));
    }
  },

  loadConflict: async path => {
    const repo = get().repo;
    if (!repo) return;
    set({ conflict: await gitService.parseConflictFile(repo.path, path) });
  },
}));
