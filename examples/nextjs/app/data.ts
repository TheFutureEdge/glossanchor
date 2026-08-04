import { buildGlossaryIndex } from "glossanchor";

export const entries = [
  {
    id: "sample-rate",
    label: "sample rate",
    aliases: ["sampling frequency"],
    definition: "The observations collected per unit of time.",
  },
];
export const text = "Sample rate is also called sampling frequency.";
export const index = buildGlossaryIndex(entries);
