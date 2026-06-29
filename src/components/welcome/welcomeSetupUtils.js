export const SHORTCUTS = [
  { keys: 'Ctrl R', label: 'Refresh' },
  { keys: 'Ctrl ↵', label: 'Commit' },
  { keys: 'Ctrl ⇧ P', label: 'Push' },
];

export const SETUP_STEPS = [
  { icon: 'FolderOpen', title: 'Open', text: 'Pick an existing repository on your machine.' },
  { icon: 'GitBranchPlus', title: 'Clone', text: 'Bring a remote repository into your workspace.' },
  { icon: 'Rocket', title: 'Ship', text: 'Review changes, commit, push, and resolve conflicts.' },
];

export const HIGHLIGHTS = [
  { icon: 'ShieldCheck', label: 'Safe local-first workflow' },
  { icon: 'Layers3', label: 'Visual branch graph' },
  { icon: 'TerminalSquare', label: 'Command log included' },
];

export function inferRepoName(url) {
  return (url.split(/[\\/]/).pop() ?? 'repository').replace(/\.git$/, '') || 'repository';
}

export function joinPath(parent, child) {
  return `${parent.replace(/[\\/]+$/, '')}${parent.includes('\\') ? '\\' : '/'}${child.replace(/^[\\/]+/, '')}`;
}

export function getSuggestedRepoName(cloneUrl) {
  const trimmedUrl = cloneUrl.trim();
  return trimmedUrl ? inferRepoName(trimmedUrl) : 'my-repository';
}

export function getDestinationPreview(destinationParent, destinationName, suggestedName) {
  return destinationParent
    ? joinPath(destinationParent, destinationName.trim() || suggestedName)
    : 'Choose a parent folder to preview the install path';
}
