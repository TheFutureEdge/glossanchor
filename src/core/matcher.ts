import type {
  BuildGlossaryIndexOptions,
  FindGlossaryMatchesOptions,
  GlossaryEntry,
  GlossaryIndex,
  GlossaryMatch,
  NormalizationOptions,
  TextSegment,
} from "./types.js";

interface TrieNode<Metadata> {
  children: Map<string, TrieNode<Metadata>>;
  terminal?: IndexedTerm<Metadata>;
}

interface IndexedTerm<Metadata> {
  entry: GlossaryEntry<Metadata>;
  normalized: string;
  source: string;
  tokenCount: number;
}

interface InternalGlossaryIndex<Metadata> {
  normalization: Required<Pick<NormalizationOptions, "caseSensitive">> &
    Omit<NormalizationOptions, "caseSensitive">;
  root: TrieNode<Metadata>;
}

interface NormalizedText {
  endOffsets: number[];
  startOffsets: number[];
  value: string;
}

const indexInternals = new WeakMap<
  GlossaryIndex<unknown>,
  InternalGlossaryIndex<unknown>
>();
const wordCharacterPattern = /[\p{L}\p{N}_]/u;
const combiningMarkPattern = /\p{M}/u;

function getIndexInternals<Metadata>(
  index: GlossaryIndex<Metadata>,
): InternalGlossaryIndex<Metadata> | undefined {
  return indexInternals.get(index) as
    InternalGlossaryIndex<Metadata> | undefined;
}

function createTrieNode<Metadata>(): TrieNode<Metadata> {
  return { children: new Map() };
}

function validateNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && wordCharacterPattern.test(value);
}

function codePointBefore(text: string, offset: number): string | undefined {
  if (offset <= 0) {
    return undefined;
  }

  const trailingCodeUnit = text.charCodeAt(offset - 1);
  const startsSurrogatePair =
    trailingCodeUnit >= 0xdc00 &&
    trailingCodeUnit <= 0xdfff &&
    offset >= 2 &&
    text.charCodeAt(offset - 2) >= 0xd800 &&
    text.charCodeAt(offset - 2) <= 0xdbff;
  return text.slice(offset - (startsSurrogatePair ? 2 : 1), offset);
}

function codePointAt(text: string, offset: number): string | undefined {
  if (offset >= text.length) {
    return undefined;
  }

  const value = text.codePointAt(offset);
  return value === undefined ? undefined : String.fromCodePoint(value);
}

function hasValidBoundaries(
  text: string,
  start: number,
  end: number,
  matchedText: string,
): boolean {
  const first = codePointAt(matchedText, 0);
  const last = codePointBefore(matchedText, matchedText.length);

  if (isWordCharacter(first) && isWordCharacter(codePointBefore(text, start))) {
    return false;
  }
  if (isWordCharacter(last) && isWordCharacter(codePointAt(text, end))) {
    return false;
  }
  return true;
}

function normalizeOptions(
  options: NormalizationOptions = {},
): InternalGlossaryIndex<unknown>["normalization"] {
  return {
    caseSensitive: options.caseSensitive ?? false,
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.normalizeUnicode === undefined
      ? { normalizeUnicode: "NFKC" as const }
      : { normalizeUnicode: options.normalizeUnicode }),
  };
}

export function normalizeGlossaryTerm(
  value: string,
  options: NormalizationOptions = {},
): string {
  const normalizedOptions = normalizeOptions(options);
  let normalized = value;

  if (normalizedOptions.normalizeUnicode !== false) {
    normalized = normalized.normalize(normalizedOptions.normalizeUnicode);
  }
  if (!normalizedOptions.caseSensitive) {
    normalized =
      normalizedOptions.locale === undefined
        ? normalized.toLocaleLowerCase()
        : normalized.toLocaleLowerCase(normalizedOptions.locale);
  }
  return normalized;
}

function normalizeTextWithOffsets(
  text: string,
  options: NormalizationOptions,
): NormalizedText {
  const chunks: string[] = [];
  const startOffsets: number[] = [];
  const endOffsets: number[] = [];

  for (let sourceStart = 0; sourceStart < text.length;) {
    const firstCharacter = codePointAt(text, sourceStart);
    if (firstCharacter === undefined) {
      break;
    }

    let sourceEnd = sourceStart + firstCharacter.length;
    for (;;) {
      const nextCharacter = codePointAt(text, sourceEnd);
      if (
        nextCharacter === undefined ||
        !combiningMarkPattern.test(nextCharacter)
      ) {
        break;
      }
      sourceEnd += nextCharacter.length;
    }

    const normalizedCluster = normalizeGlossaryTerm(
      text.slice(sourceStart, sourceEnd),
      options,
    );
    chunks.push(normalizedCluster);
    for (let index = 0; index < normalizedCluster.length; index += 1) {
      startOffsets.push(sourceStart);
      endOffsets.push(sourceEnd);
    }
    sourceStart = sourceEnd;
  }

  return {
    value: chunks.join(""),
    startOffsets,
    endOffsets,
  };
}

function insertTerm<Metadata>(
  root: TrieNode<Metadata>,
  term: IndexedTerm<Metadata>,
): void {
  let node = root;
  for (let index = 0; index < term.normalized.length; index += 1) {
    const character = term.normalized[index];
    if (character === undefined) {
      continue;
    }
    let child = node.children.get(character);
    if (child === undefined) {
      child = createTrieNode();
      node.children.set(character, child);
    }
    node = child;
  }
  node.terminal = term;
}

export function buildGlossaryIndex<Metadata = unknown>(
  entries: readonly GlossaryEntry<Metadata>[],
  options: BuildGlossaryIndexOptions = {},
): GlossaryIndex<Metadata> {
  const normalization = normalizeOptions(options);
  const duplicateStrategy = options.duplicateTermStrategy ?? "error";
  const indexedTerms = new Map<string, IndexedTerm<Metadata>>();
  let maxTermTokens = 0;

  entries.forEach((entry) => {
    if (entry.id.trim().length === 0) {
      throw new TypeError("Glossary entry ids must not be empty.");
    }
    if (entry.label.trim().length === 0) {
      throw new TypeError(`Glossary entry "${entry.id}" has an empty label.`);
    }

    const sourceTerms = [entry.label, ...(entry.aliases ?? [])];
    const entryTerms = new Set<string>();
    sourceTerms.forEach((source) => {
      if (source.trim().length === 0) {
        throw new TypeError(`Glossary entry "${entry.id}" has an empty alias.`);
      }

      const normalized = normalizeGlossaryTerm(source, normalization);
      if (normalized.length === 0) {
        throw new TypeError(
          `Glossary entry "${entry.id}" has a term that normalizes to an empty string.`,
        );
      }
      if (entryTerms.has(normalized)) {
        return;
      }
      entryTerms.add(normalized);

      const existing = indexedTerms.get(normalized);
      if (existing !== undefined && existing.entry.id !== entry.id) {
        if (duplicateStrategy === "error") {
          throw new TypeError(
            `Duplicate normalized glossary term "${normalized}" belongs to both ` +
              `"${existing.entry.id}" and "${entry.id}".`,
          );
        }
        if (duplicateStrategy === "first") {
          return;
        }
      }

      const tokenCount = normalized.trim().split(/\s+/u).length;
      maxTermTokens = Math.max(maxTermTokens, tokenCount);
      indexedTerms.set(normalized, {
        entry,
        normalized,
        source,
        tokenCount,
      });
    });
  });

  const root = createTrieNode<Metadata>();
  indexedTerms.forEach((term) => {
    insertTerm(root, term);
  });

  const index: GlossaryIndex<Metadata> = Object.freeze({
    entries: Object.freeze([...entries]),
    maxTermTokens,
    termCount: indexedTerms.size,
  });
  indexInternals.set(index, { normalization, root });
  return index;
}

export function findGlossaryMatches<Metadata = unknown>(
  text: string,
  index: GlossaryIndex<Metadata>,
  options: FindGlossaryMatchesOptions<Metadata> = {},
): GlossaryMatch<Metadata>[] {
  const maxMatches = options.maxMatches ?? Number.MAX_SAFE_INTEGER;
  validateNonNegativeInteger(maxMatches, "maxMatches");
  if (maxMatches === 0 || text.length === 0) {
    return [];
  }

  const internal = getIndexInternals(index);
  if (internal === undefined) {
    throw new TypeError(
      "The glossary index was not created by buildGlossaryIndex().",
    );
  }

  const normalizedText = normalizeTextWithOffsets(text, internal.normalization);
  const matches: GlossaryMatch<Metadata>[] = [];
  const matchedEntryIds = new Set<string>();

  for (
    let normalizedStart = 0;
    normalizedStart < normalizedText.value.length &&
    matches.length < maxMatches;
  ) {
    if (
      normalizedStart > 0 &&
      normalizedText.startOffsets[normalizedStart] ===
        normalizedText.startOffsets[normalizedStart - 1]
    ) {
      normalizedStart += 1;
      continue;
    }

    let node = internal.root;
    let normalizedEnd = normalizedStart;
    let best:
      | {
          end: number;
          sourceEnd: number;
          sourceStart: number;
          term: IndexedTerm<Metadata>;
        }
      | undefined;

    while (normalizedEnd < normalizedText.value.length) {
      const character = normalizedText.value[normalizedEnd];
      if (character === undefined) {
        break;
      }
      const child = node.children.get(character);
      if (child === undefined) {
        break;
      }

      node = child;
      normalizedEnd += 1;
      if (node.terminal === undefined) {
        continue;
      }

      const sourceStart = normalizedText.startOffsets[normalizedStart];
      const sourceEnd = normalizedText.endOffsets[normalizedEnd - 1];
      if (sourceStart === undefined || sourceEnd === undefined) {
        continue;
      }
      const matchedText = text.slice(sourceStart, sourceEnd);
      const isAllowed =
        (options.filter?.(node.terminal.entry) ?? true) &&
        (!options.uniqueEntries ||
          !matchedEntryIds.has(node.terminal.entry.id)) &&
        hasValidBoundaries(text, sourceStart, sourceEnd, matchedText);
      if (isAllowed) {
        best = {
          end: normalizedEnd,
          sourceEnd,
          sourceStart,
          term: node.terminal,
        };
      }
    }

    if (best === undefined) {
      normalizedStart += 1;
      continue;
    }

    matches.push({
      start: best.sourceStart,
      end: best.sourceEnd,
      text: text.slice(best.sourceStart, best.sourceEnd),
      entry: best.term.entry,
    });
    matchedEntryIds.add(best.term.entry.id);
    normalizedStart = best.end;
  }

  return matches;
}

export function segmentGlossaryText<Metadata = unknown>(
  text: string,
  matches: readonly GlossaryMatch<Metadata>[],
): TextSegment<Metadata>[] {
  const segments: TextSegment<Metadata>[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (
      !Number.isSafeInteger(match.start) ||
      !Number.isSafeInteger(match.end) ||
      match.start < cursor ||
      match.end <= match.start ||
      match.end > text.length ||
      text.slice(match.start, match.end) !== match.text
    ) {
      throw new RangeError(
        "Glossary matches must be ordered, non-overlapping, in range, and match the source text.",
      );
    }

    if (cursor < match.start) {
      segments.push({
        start: cursor,
        end: match.start,
        text: text.slice(cursor, match.start),
        type: "text",
      });
    }
    segments.push({
      start: match.start,
      end: match.end,
      text: match.text,
      type: "match",
      match,
    });
    cursor = match.end;
  });

  if (cursor < text.length) {
    segments.push({
      start: cursor,
      end: text.length,
      text: text.slice(cursor),
      type: "text",
    });
  }
  return segments;
}
