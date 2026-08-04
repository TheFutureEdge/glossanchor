export type {
  BuildGlossaryIndexOptions,
  DuplicateTermStrategy,
  FindGlossaryMatchesOptions,
  GlossaryEntry,
  GlossaryIndex,
  GlossaryMatch,
  NormalizationOptions,
  TextSegment,
} from "./core/types.js";

export {
  buildGlossaryIndex,
  findGlossaryMatches,
  normalizeGlossaryTerm,
  segmentGlossaryText,
} from "./core/matcher.js";
