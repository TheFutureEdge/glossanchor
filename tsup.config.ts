import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    glossary: "src/glossary.ts",
    index: "src/index.ts",
    interaction: "src/interaction.ts",
    react: "src/react.tsx",
  },
  external: ["react", "react/jsx-runtime"],
  format: ["esm"],
  minify: true,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  treeshake: true,
});
