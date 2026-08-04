/* global console, process */

import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = execFileSync(
  process.env.npm_execpath,
  ["pack", "--dry-run", "--json"],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: join(tmpdir(), "glossanchor-npm-cache"),
    },
  },
);
/** @type {unknown} */
const parsed = JSON.parse(output);
if (!Array.isArray(parsed)) {
  throw new TypeError("npm pack returned an unexpected report.");
}
/** @type {unknown} */
const candidate = parsed[0];
if (candidate === null || typeof candidate !== "object") {
  throw new TypeError("npm pack returned an invalid package report.");
}
const report = /** @type {Record<string, unknown>} */ (candidate);
const fileCandidates = report.files;
if (!Array.isArray(fileCandidates)) {
  throw new TypeError("npm pack did not return a file list.");
}
const files = fileCandidates.map((value) => {
  const candidateFile = /** @type {unknown} */ (value);
  if (
    candidateFile === null ||
    typeof candidateFile !== "object" ||
    !("path" in candidateFile)
  ) {
    throw new TypeError("npm pack returned an invalid file entry.");
  }
  const path = /** @type {Record<string, unknown>} */ (candidateFile).path;
  if (typeof path !== "string") {
    throw new TypeError("npm pack returned an invalid file path.");
  }
  return path;
});

if (files.length === 0) {
  throw new Error("GlossAnchor package inspection returned no files.");
}
const allowedRootFiles = new Set(["LICENSE", "README.md", "package.json"]);
if (
  files.some((file) => !file.startsWith("dist/") && !allowedRootFiles.has(file))
) {
  throw new Error("GlossAnchor package contains an unexpected public file.");
}

console.log(
  JSON.stringify({
    files,
    packageSize: report.size,
    unpackedSize: report.unpackedSize,
  }),
);
