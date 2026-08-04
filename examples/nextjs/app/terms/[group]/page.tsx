import {
  createGlossaryAnchorId,
  groupGlossaryEntries,
} from "glossanchor/glossary";

import { entries } from "../../data";

export function generateStaticParams() {
  return [{ group: "q-t" }];
}

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  const groupedEntries = groupGlossaryEntries(entries, {
    resolveGroup: () => ({ id: "q-t", label: "Q-T" }),
  }).find((candidate) => candidate.id === group)?.entries;

  if (groupedEntries === undefined)
    return <main>Glossary group not found.</main>;
  return (
    <main>
      <h1>Terms Q-T</h1>
      {groupedEntries.map((entry) => (
        <article id={createGlossaryAnchorId(entry)} key={entry.id}>
          <h2>{entry.label}</h2>
          <p>{entry.definition}</p>
        </article>
      ))}
    </main>
  );
}
