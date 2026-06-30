export type RepoConfig = {
  autoFetchInterval?: number; // seconds; undefined = inherit global setting
};

const KEY = 'gitpilot_repo_config';

function load(): Record<string, RepoConfig> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, RepoConfig>; }
  catch { return {}; }
}

export function getRepoConfig(path: string): RepoConfig {
  return load()[path] ?? {};
}

export function setRepoConfig(path: string, config: Partial<RepoConfig>): void {
  const all = load();
  all[path] = { ...all[path], ...config };
  localStorage.setItem(KEY, JSON.stringify(all));
}
