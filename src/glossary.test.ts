import { describe, expect, it } from "vitest";

import {
  createGlossaryAnchorId,
  createGroupedGlossaryHref,
  groupGlossaryEntries,
} from "./glossary.js";

describe("glossary helpers", () => {
  const entries = [
    { id: "beta", label: "Beta" },
    { id: "api rate", label: "API rate" },
    { id: "42", label: "42-day cycle" },
    { id: "alpha", label: "alpha" },
  ];

  it("creates stable anchor ids from canonical ids", () => {
    expect(createGlossaryAnchorId(entries[1]!)).toBe("term-api rate");
    expect(() => createGlossaryAnchorId("  ")).toThrow(/must not be empty/u);
  });

  it("groups and sorts entries alphabetically with a fallback group", () => {
    const groups = groupGlossaryEntries(entries);
    expect(groups.map(({ id, label }) => [id, label])).toEqual([
      ["other", "#"],
      ["a", "A"],
      ["b", "B"],
    ]);
    expect(groups[1]?.entries.map((entry) => entry.id)).toEqual([
      "alpha",
      "api rate",
    ]);
  });

  it("supports consumer-defined grouped pages and URL fragments", () => {
    const href = createGroupedGlossaryHref(entries[1]!, {
      basePath: "/technical-terms/",
      resolveGroup: () => "a-d",
    });
    expect(href).toBe("/technical-terms/a-d#term-api%20rate");
  });

  it("rejects conflicting custom group labels", () => {
    expect(() =>
      groupGlossaryEntries(entries.slice(0, 2), {
        resolveGroup: (entry) => ({
          id: "all",
          label: entry.id,
        }),
      }),
    ).toThrow(/conflicting labels/u);
  });
});
