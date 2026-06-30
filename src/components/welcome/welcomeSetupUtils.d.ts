export type WelcomeIconName =
  | 'FolderOpen'
  | 'GitBranchPlus'
  | 'Rocket'
  | 'ShieldCheck'
  | 'Layers3'
  | 'TerminalSquare';

export interface SetupStep {
  icon: WelcomeIconName;
  title: string;
  text: string;
}

export interface HighlightItem {
  icon: WelcomeIconName;
  label: string;
}

export interface ShortcutItem {
  keys: string;
  label: string;
}

export const SHORTCUTS: readonly ShortcutItem[];
export const SETUP_STEPS: readonly SetupStep[];
export const HIGHLIGHTS: readonly HighlightItem[];
export function inferRepoName(url: string): string;
export function joinPath(parent: string, child: string): string;
export function getSuggestedRepoName(cloneUrl: string): string;
export function getDestinationPreview(destinationParent: string, destinationName: string, suggestedName: string): string;
