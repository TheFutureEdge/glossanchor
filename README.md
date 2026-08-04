# GlossAnchor

GlossAnchor is a small TypeScript library for matching glossary terms and
rendering accessible inline definitions with crawlable links. It keeps the
framework-neutral matcher, React renderer, browser interactions, and grouped
glossary helpers in separate tree-shakeable exports.

## Features

- longest-match-first labels and aliases with exact source offsets;
- Unicode normalization and configurable case handling;
- one server-rendered glossary link per canonical entry, with later matches
  remaining definition-enabled;
- opt-in delegated keyboard, pointer, touch, focus, and asynchronous-definition
  interactions;
- A-Z grouping, stable anchor IDs, and consumer-controlled grouped-page URLs;
- zero core production dependencies and independently enforced 4 KiB gzip
  budgets.

## Install

```sh
npm install glossanchor
```

React is an optional peer dependency required only by `glossanchor/react`.

## Match terms

```ts
import { buildGlossaryIndex, findGlossaryMatches } from "glossanchor";

const entries = [
  {
    id: "sample-rate",
    label: "sample rate",
    aliases: ["sampling frequency"],
    definition: "The observations collected per unit of time.",
    href: "/terms/q-t#term-sample-rate",
  },
];
const text = "Sample rate and sampling frequency describe the same concept.";
const index = buildGlossaryIndex(entries);
const matches = findGlossaryMatches(text, index);
```

`maxMatches` and `uniqueEntries` are optional general-purpose controls. A
consumer can omit both to annotate every eligible occurrence.

## Render in React

```tsx
import { AnnotatedGlossaryText } from "glossanchor/react";

<AnnotatedGlossaryText
  fullEntryLabel="View full glossary entry"
  linkTarget="_blank"
  matches={matches}
  text={text}
/>;
```

The first occurrence of each canonical entry with an `href` is an anchor in
server-rendered HTML. Later label or alias occurrences are definition-only
buttons. Without JavaScript, the first anchor navigates normally.

## Add browser interactions

```ts
import { enhanceGlossaryInteractions } from "glossanchor/interaction";

const controller = enhanceGlossaryInteractions(document);
// Call controller.destroy() when the owning application is removed.
```

Ordinary primary activation opens the definition. Modified link activation is
not intercepted. Escape closes the definition and restores focus.

## Build grouped glossary URLs

```ts
import {
  createGlossaryAnchorId,
  createGroupedGlossaryHref,
  groupGlossaryEntries,
} from "glossanchor/glossary";

const groups = groupGlossaryEntries(entries);
const id = createGlossaryAnchorId(entries[0]);
const href = createGroupedGlossaryHref(entries[0], {
  basePath: "/terms",
  resolveGroup: () => "q-t",
});
```

GlossAnchor does not create routes or metadata. The application owns its page
groups, definitions, URL mapping, styling, and sitemap.

## Exports

- `glossanchor`: matching, segmentation, types, and normalization;
- `glossanchor/react`: server-renderable React annotations;
- `glossanchor/interaction`: optional delegated browser behavior;
- `glossanchor/glossary`: A-Z grouping, anchors, and grouped URLs.

See [`examples/nextjs`](./examples/nextjs) for a synthetic Next.js example.

## Development

```sh
npm ci
npm run verify
```

## Security and privacy

GlossAnchor performs deterministic in-memory text processing and makes no
network or storage calls. See [SECURITY.md](./SECURITY.md) for reporting.

## About Future Edge Group

GlossAnchor is maintained by [Future Edge Group FZE](https://ftredge.com), a
UAE-based AI, technology, data, and digital-product company. Future Edge Group
is also the company behind [iPulse AI](https://ipulseai.com), an Open Agentic
Investment Research Platform.

## License

MIT License. Copyright (c) 2026 Future Edge Group FZE.
