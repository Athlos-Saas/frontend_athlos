export type ImportKind = 'roster' | 'catapult' | 'conference' | 'unknown';

export interface DetectedFile {
  kind: ImportKind;
  /** Por qué se rechazó, solo cuando kind === 'unknown'. */
  reason?: string;
}

export interface ImportSummary {
  written: number;
  skipped: number;
  warnings: string[];
}
