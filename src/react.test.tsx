import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildGlossaryIndex, findGlossaryMatches } from "./index.js";
import { AnnotatedGlossaryText } from "./react.js";

describe("AnnotatedGlossaryText", () => {
  it("links only the first canonical occurrence and defines every occurrence", () => {
    const entries = [
      {
        id: "sample-rate",
        label: "sample rate",
        aliases: ["sampling frequency"],
        definition: "The observations collected per unit of time.",
        href: "/terms/a-d#sample-rate",
      },
    ];
    const text = "Sample rate and sampling frequency affect the sample rate.";
    const index = buildGlossaryIndex(entries);
    const html = renderToStaticMarkup(
      <AnnotatedGlossaryText
        fullEntryLabel="View full glossary entry"
        linkTarget="_blank"
        matches={findGlossaryMatches(text, index)}
        text={text}
      />,
    );

    expect(html.match(/data-glossanchor-entry="sample-rate"/gu)).toHaveLength(
      3,
    );
    expect(html.match(/<a /gu)).toHaveLength(2);
    expect(html.match(/<button /gu)).toHaveLength(2);
    expect(html.match(/data-glossanchor-definition=""/gu)).toHaveLength(1);
    expect(
      html.match(/The observations collected per unit of time\./gu),
    ).toHaveLength(1);
    expect(html).toContain('href="/terms/a-d#sample-rate"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders crawlable anchors before interaction without requiring definitions", () => {
    const text = "API";
    const index = buildGlossaryIndex([
      { id: "api", label: "API", href: "/terms/a-d#api" },
    ]);
    const html = renderToStaticMarkup(
      <AnnotatedGlossaryText
        matches={findGlossaryMatches(text, index)}
        text={text}
      />,
    );

    expect(html).toContain('<a data-glossanchor-entry="api"');
    expect(html).toContain('href="/terms/a-d#api"');
    expect(html).not.toContain("data-glossanchor-definition");
  });

  it("supports custom renderers without changing segmentation", () => {
    const text = "API text";
    const index = buildGlossaryIndex([
      { id: "api", label: "API", definition: "An interface." },
    ]);
    const html = renderToStaticMarkup(
      <AnnotatedGlossaryText
        matches={findGlossaryMatches(text, index)}
        renderText={(segment) => <i>{segment.text}</i>}
        renderTrigger={(context) => (
          <strong data-occurrence={context.occurrence}>
            {context.match.text}
          </strong>
        )}
        text={text}
      />,
    );

    expect(html).toContain('<strong data-occurrence="1">API</strong>');
    expect(html).toContain("<i> text</i>");
  });

  it("supports consumer-controlled href resolution", () => {
    const text = "API";
    const index = buildGlossaryIndex([
      { id: "api", label: "API", definition: "An interface." },
    ]);
    const html = renderToStaticMarkup(
      <AnnotatedGlossaryText
        matches={findGlossaryMatches(text, index)}
        resolveHref={(entry) => `/terms/a-d#term-${entry.id}`}
        text={text}
      />,
    );
    expect(html).toContain('href="/terms/a-d#term-api"');
  });
});
