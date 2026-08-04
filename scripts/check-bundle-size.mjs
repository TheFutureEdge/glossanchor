/* global console */

import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const budgets = [
  {
    file: new URL("../dist/glossary.js", import.meta.url),
    label: "glossary",
    maxGzipBytes: 4 * 1024,
  },
  {
    file: new URL("../dist/index.js", import.meta.url),
    label: "core",
    maxGzipBytes: 4 * 1024,
  },
  {
    file: new URL("../dist/react.js", import.meta.url),
    label: "react",
    maxGzipBytes: 4 * 1024,
  },
  {
    file: new URL("../dist/interaction.js", import.meta.url),
    label: "interaction",
    maxGzipBytes: 4 * 1024,
  },
];

let failed = false;

for (const budget of budgets) {
  const output = await readFile(budget.file);
  const gzipBytes = gzipSync(output, { level: 9 }).byteLength;
  const result = {
    entry: budget.label,
    rawBytes: output.byteLength,
    gzipBytes,
    maxGzipBytes: budget.maxGzipBytes,
  };

  console.log(JSON.stringify(result));
  if (gzipBytes > budget.maxGzipBytes) {
    failed = true;
  }
}

if (failed) {
  throw new Error("GlossAnchor bundle size budget exceeded.");
}
