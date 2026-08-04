import type { GlossaryEntry } from "./core/types.js";

export interface GlossaryGroup<Metadata = unknown> {
  entries: readonly GlossaryEntry<Metadata>[];
  id: string;
  label: string;
}

export interface GlossaryGroupKey {
  id: string;
  label: string;
}

export interface GroupGlossaryEntriesOptions<Metadata = unknown> {
  compareEntries?: (
    left: GlossaryEntry<Metadata>,
    right: GlossaryEntry<Metadata>,
  ) => number;
  fallbackGroup?: GlossaryGroupKey;
  locale?: string | readonly string[];
  resolveGroup?: (entry: GlossaryEntry<Metadata>) => GlossaryGroupKey;
}

export interface GroupedGlossaryHrefOptions<Metadata = unknown> {
  anchorPrefix?: string;
  basePath: string;
  resolveGroup?: (entry: GlossaryEntry<Metadata>) => string;
}

const defaultFallbackGroup: GlossaryGroupKey = { id: "other", label: "#" };

function entryId(entryOrId: GlossaryEntry<unknown> | string): string {
  return typeof entryOrId === "string" ? entryOrId : entryOrId.id;
}

export function createGlossaryAnchorId(
  entryOrId: GlossaryEntry<unknown> | string,
  prefix = "term-",
): string {
  const id = entryId(entryOrId).trim();
  if (id.length === 0) {
    throw new TypeError("Glossary entry ids must not be empty.");
  }
  return `${prefix}${id}`;
}

export function getAlphabeticalGlossaryGroup<Metadata = unknown>(
  entry: GlossaryEntry<Metadata>,
  fallbackGroup: GlossaryGroupKey = defaultFallbackGroup,
): GlossaryGroupKey {
  const first = entry.label.trim().charAt(0).toLocaleUpperCase();
  return /^[A-Z]$/u.test(first)
    ? { id: first.toLowerCase(), label: first }
    : fallbackGroup;
}

export function groupGlossaryEntries<Metadata = unknown>(
  entries: readonly GlossaryEntry<Metadata>[],
  options: GroupGlossaryEntriesOptions<Metadata> = {},
): GlossaryGroup<Metadata>[] {
  const groups = new Map<
    string,
    { entries: GlossaryEntry<Metadata>[]; label: string }
  >();
  const fallback = options.fallbackGroup ?? defaultFallbackGroup;
  const resolveGroup =
    options.resolveGroup ??
    ((entry: GlossaryEntry<Metadata>) =>
      getAlphabeticalGlossaryGroup(entry, fallback));
  const compare =
    options.compareEntries ??
    ((left: GlossaryEntry<Metadata>, right: GlossaryEntry<Metadata>) =>
      left.label.localeCompare(right.label, options.locale, {
        sensitivity: "base",
      }));

  for (const entry of entries) {
    const key = resolveGroup(entry);
    if (key.id.trim().length === 0 || key.label.trim().length === 0) {
      throw new TypeError("Glossary group ids and labels must not be empty.");
    }
    const existing = groups.get(key.id);
    if (existing !== undefined && existing.label !== key.label) {
      throw new TypeError(`Glossary group "${key.id}" has conflicting labels.`);
    }
    if (existing === undefined) {
      groups.set(key.id, { entries: [entry], label: key.label });
    } else {
      existing.entries.push(entry);
    }
  }

  return [...groups]
    .map(([id, group]) => ({
      entries: Object.freeze([...group.entries].sort(compare)),
      id,
      label: group.label,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, options.locale),
    );
}

export function createGroupedGlossaryHref<Metadata = unknown>(
  entry: GlossaryEntry<Metadata>,
  options: GroupedGlossaryHrefOptions<Metadata>,
): string {
  const group =
    options.resolveGroup?.(entry) ?? getAlphabeticalGlossaryGroup(entry).id;
  const basePath = options.basePath.replace(/\/+$/u, "");
  const groupPath = group.replace(/^\/+|\/+$/gu, "");
  const anchor = encodeURIComponent(
    createGlossaryAnchorId(entry, options.anchorPrefix),
  );
  return `${basePath}/${groupPath}#${anchor}`;
}
