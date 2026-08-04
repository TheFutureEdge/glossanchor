export interface GlossaryEntry<Metadata = unknown> {
  id: string;
  label: string;
  definition?: string;
  aliases?: readonly string[];
  href?: string;
  metadata?: Metadata;
}

export type DuplicateTermStrategy = "error" | "first" | "last";

export interface NormalizationOptions {
  caseSensitive?: boolean;
  locale?: string | readonly string[];
  normalizeUnicode?: false | "NFC" | "NFD" | "NFKC" | "NFKD";
}

export interface BuildGlossaryIndexOptions extends NormalizationOptions {
  duplicateTermStrategy?: DuplicateTermStrategy;
}

export interface FindGlossaryMatchesOptions<Metadata = unknown> {
  filter?: (entry: GlossaryEntry<Metadata>) => boolean;
  maxMatches?: number;
  uniqueEntries?: boolean;
}

export interface GlossaryMatch<Metadata = unknown> {
  end: number;
  entry: GlossaryEntry<Metadata>;
  start: number;
  text: string;
}

export interface TextSegment<Metadata = unknown> {
  end: number;
  match?: GlossaryMatch<Metadata>;
  start: number;
  text: string;
  type: "match" | "text";
}

export interface GlossaryIndex<Metadata = unknown> {
  readonly entries: readonly GlossaryEntry<Metadata>[];
  readonly maxTermTokens: number;
  readonly termCount: number;
}
