import { findGlossaryMatches } from "glossanchor";
import { createGroupedGlossaryHref } from "glossanchor/glossary";
import { AnnotatedGlossaryText } from "glossanchor/react";

import { index, text } from "./data";
import { GlossaryInteractions } from "./interactions";

export default function Page() {
  return (
    <main>
      <h1>Synthetic GlossAnchor example</h1>
      <p>
        <AnnotatedGlossaryText
          fullEntryLabel="View full glossary entry"
          matches={findGlossaryMatches(text, index)}
          resolveHref={(entry) =>
            createGroupedGlossaryHref(entry, {
              basePath: "/terms",
              resolveGroup: () => "q-t",
            })
          }
          text={text}
        />
      </p>
      <GlossaryInteractions />
    </main>
  );
}
