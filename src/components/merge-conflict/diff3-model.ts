import type { ConflictBlock } from './types';

export type { ConflictBlock };

export function findConflicts(content: string): ConflictBlock[] {
  const lines = content.split('\n');
  const blocks: ConflictBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('<<<<<<<')) {
      const startLine = i + 1;
      const oursLabel = line.slice(7).trim() || 'HEAD';
      i++;
      const oursLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('=======') && !lines[i].startsWith('|||||||')) {
        oursLines.push(lines[i]);
        i++;
      }
      // skip ======= or ||||||| separator(s)
      while (i < lines.length && (lines[i].startsWith('=======') || lines[i].startsWith('|||||||'))) i++;
      const theirsLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirsLines.push(lines[i]);
        i++;
      }
      const theirsLabel = lines[i]?.slice(7).trim() || 'incoming';
      const endLine = i + 1;
      blocks.push({ index: blocks.length, startLine, endLine, oursLines, theirsLines, oursLabel, theirsLabel });
    }
    i++;
  }
  return blocks;
}

export type ResolveChoice = 'ours' | 'theirs' | 'both' | 'theirs-then-ours';

export function resolveBlock(
  content: string,
  blocks: ConflictBlock[],
  blockIndex: number,
  choice: ResolveChoice,
): string {
  const block = blocks[blockIndex];
  if (!block) return content;
  const lines = content.split('\n');
  const resolved =
    choice === 'ours' ? block.oursLines
    : choice === 'theirs' ? block.theirsLines
    : choice === 'both' ? [...block.oursLines, ...block.theirsLines]
    : [...block.theirsLines, ...block.oursLines];
  lines.splice(block.startLine - 1, block.endLine - block.startLine + 1, ...resolved);
  return lines.join('\n');
}

export function resolveAll(content: string, choice: 'ours' | 'theirs'): string {
  let result = content;
  let blocks = findConflicts(result);
  while (blocks.length > 0) {
    result = resolveBlock(result, blocks, blocks.length - 1, choice);
    blocks = findConflicts(result);
  }
  return result;
}

export function hasConflicts(content: string): boolean {
  return content.split('\n').some(l => l.startsWith('<<<<<<<'));
}

export function countConflicts(content: string): number {
  return content.split('\n').filter(l => l.startsWith('<<<<<<<')).length;
}
