import { describe, expect, it } from "vitest";

import {
  buildGlossaryIndex,
  findGlossaryMatches,
  normalizeGlossaryTerm,
  segmentGlossaryText,
  type GlossaryEntry,
  type GlossaryMatch,
} from "./index.js";

describe("public contracts", () => {
  it("represent a synthetic term and its exact source range", () => {
    const entry: GlossaryEntry = {
      id: "sample-rate",
      label: "sample rate",
      definition: "The number of observations collected per unit of time.",
      aliases: ["sampling frequency"],
      href: "/terms/sample-rate",
    };
    const match: GlossaryMatch = {
      start: 4,
      end: 15,
      text: "sample rate",
      entry,
    };

    expect(match.text).toBe("sample rate");
    expect(match.entry.href).toBe("/terms/sample-rate");
  });
});

describe("normalizeGlossaryTerm", () => {
  it("uses case-insensitive NFKC normalization by default", () => {
    expect(normalizeGlossaryTerm("Ａgent")).toBe("agent");
  });

  it("supports case-sensitive matching", () => {
    expect(normalizeGlossaryTerm("FHIR", { caseSensitive: true })).toBe("FHIR");
  });
});

describe("buildGlossaryIndex", () => {
  const entries: GlossaryEntry[] = [
    {
      id: "sample",
      label: "sample",
      definition: "A selected observation.",
    },
    {
      id: "sample-rate",
      label: "sample rate",
      aliases: ["sampling frequency"],
    },
  ];

  it("indexes labels and aliases deterministically", () => {
    const index = buildGlossaryIndex(entries);

    expect(index.termCount).toBe(3);
    expect(index.maxTermTokens).toBe(2);
    expect(index.entries).toEqual(entries);
  });

  it("rejects duplicate normalized terms by default", () => {
    expect(() =>
      buildGlossaryIndex([
        { id: "first", label: "API" },
        { id: "second", label: "api" },
      ]),
    ).toThrow(/Duplicate normalized glossary term "api"/);
  });

  it("supports deterministic first and last duplicate strategies", () => {
    const duplicateEntries = [
      { id: "first", label: "API" },
      { id: "last", label: "api" },
    ];

    const first = buildGlossaryIndex(duplicateEntries, {
      duplicateTermStrategy: "first",
    });
    const last = buildGlossaryIndex(duplicateEntries, {
      duplicateTermStrategy: "last",
    });

    expect(findGlossaryMatches("api", first)[0]?.entry.id).toBe("first");
    expect(findGlossaryMatches("api", last)[0]?.entry.id).toBe("last");
  });

  it("rejects malformed entries and ignores duplicate aliases on one entry", () => {
    expect(() => buildGlossaryIndex([{ id: " ", label: "sample" }])).toThrow(
      /ids must not be empty/,
    );
    expect(() => buildGlossaryIndex([{ id: "sample", label: " " }])).toThrow(
      /empty label/,
    );
    expect(() =>
      buildGlossaryIndex([
        { id: "sample", label: "sample", aliases: ["sample", " "] },
      ]),
    ).toThrow(/empty alias/);

    expect(
      buildGlossaryIndex([
        { id: "sample", label: "sample", aliases: ["SAMPLE"] },
      ]).termCount,
    ).toBe(1);
  });
});

describe("findGlossaryMatches", () => {
  const entries: GlossaryEntry[] = [
    { id: "sample", label: "sample" },
    {
      id: "sample-rate",
      label: "sample rate",
      aliases: ["sampling frequency"],
    },
    { id: "api", label: "API" },
  ];
  const index = buildGlossaryIndex(entries);

  it("selects the longest term and preserves exact source offsets", () => {
    const text = "The SAMPLE RATE and sampling frequency are related.";

    const matches = findGlossaryMatches(text, index);

    expect(
      matches.map(({ start, end, text: value, entry }) => ({
        start,
        end,
        text: value,
        id: entry.id,
      })),
    ).toEqual([
      { start: 4, end: 15, text: "SAMPLE RATE", id: "sample-rate" },
      {
        start: 20,
        end: 38,
        text: "sampling frequency",
        id: "sample-rate",
      },
    ]);
  });

  it("does not match terms inside longer words", () => {
    expect(findGlossaryMatches("A sample and a sampler.", index)).toHaveLength(
      1,
    );
  });

  it("matches around punctuation and supports punctuation in terms", () => {
    const punctuationIndex = buildGlossaryIndex([
      { id: "api", label: "API" },
      { id: "cpp", label: "C++" },
    ]);

    expect(
      findGlossaryMatches("(API), C++!", punctuationIndex).map(
        (match) => match.text,
      ),
    ).toEqual(["API", "C++"]);
  });

  it("preserves UTF-16 offsets after astral characters", () => {
    const text = "🧪 sample rate";
    const [match] = findGlossaryMatches(text, index);

    expect(match).toMatchObject({
      start: 3,
      end: 14,
      text: "sample rate",
    });
  });

  it("matches canonically equivalent Unicode and keeps source offsets", () => {
    const unicodeIndex = buildGlossaryIndex([{ id: "cafe", label: "café" }]);
    const text = "A cafe\u0301.";

    expect(findGlossaryMatches(text, unicodeIndex)[0]).toMatchObject({
      start: 2,
      end: 7,
      text: "cafe\u0301",
    });
  });

  it("supports match limits, entry uniqueness, and filtering", () => {
    const text = "API, sample rate, API, sampling frequency.";

    expect(findGlossaryMatches(text, index, { maxMatches: 2 })).toHaveLength(2);
    expect(
      findGlossaryMatches(text, index, { uniqueEntries: true }).map(
        (match) => match.entry.id,
      ),
    ).toEqual(["api", "sample-rate"]);
    expect(
      findGlossaryMatches(text, index, {
        filter: (entry) => entry.id !== "api",
      }).map((match) => match.entry.id),
    ).toEqual(["sample-rate", "sample-rate"]);
  });

  it("rejects invalid match limits", () => {
    expect(() =>
      findGlossaryMatches("sample", index, { maxMatches: -1 }),
    ).toThrow(/maxMatches/);
  });
});

describe("segmentGlossaryText", () => {
  const index = buildGlossaryIndex([
    { id: "api", label: "API" },
    { id: "sample-rate", label: "sample rate" },
  ]);

  it("partitions source text without loss or empty segments", () => {
    const text = "API/sample rate.";
    const segments = segmentGlossaryText(
      text,
      findGlossaryMatches(text, index),
    );

    expect(
      segments.map(({ type, start, end, text: value }) => ({
        type,
        start,
        end,
        text: value,
      })),
    ).toEqual([
      { type: "match", start: 0, end: 3, text: "API" },
      { type: "text", start: 3, end: 4, text: "/" },
      { type: "match", start: 4, end: 15, text: "sample rate" },
      { type: "text", start: 15, end: 16, text: "." },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
  });

  it("returns a single text segment when there are no matches", () => {
    expect(segmentGlossaryText("plain text", [])).toEqual([
      { type: "text", start: 0, end: 10, text: "plain text" },
    ]);
    expect(segmentGlossaryText("", [])).toEqual([]);
  });

  it("rejects stale, overlapping, or out-of-order matches", () => {
    const text = "API API";
    const matches = findGlossaryMatches(text, index);

    expect(() =>
      segmentGlossaryText(text, [
        matches[1] as GlossaryMatch,
        matches[0] as GlossaryMatch,
      ]),
    ).toThrow(/ordered, non-overlapping/);
    expect(() =>
      segmentGlossaryText(text, [
        { ...(matches[0] as GlossaryMatch), text: "api" },
      ]),
    ).toThrow(/match the source text/);
  });
});
