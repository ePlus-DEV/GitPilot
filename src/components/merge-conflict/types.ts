export interface ConflictBlock {
  index: number;
  startLine: number;
  endLine: number;
  oursLines: string[];
  theirsLines: string[];
  oursLabel: string;
  theirsLabel: string;
}
