// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { enhanceGlossaryInteractions } from "./interaction.js";

function renderFixture(): {
  definition: HTMLElement;
  first: HTMLAnchorElement;
  repeated: HTMLButtonElement;
} {
  document.body.innerHTML = `
    <main data-test-root>
      <a data-glossanchor-entry="api" aria-describedby="definition-api"
         aria-expanded="false" href="#api">API</a>
      <button data-glossanchor-entry="api" aria-describedby="definition-api"
              aria-expanded="false">API</button>
      <span id="definition-api" data-glossanchor-definition hidden tabindex="-1">
        <span data-glossanchor-definition-content>Application interface.</span>
        <a href="/terms#api">Full entry</a>
      </span>
      <button data-outside>Outside</button>
    </main>`;
  return {
    definition: document.querySelector("#definition-api") as HTMLElement,
    first: document.querySelector(
      "a[data-glossanchor-entry]",
    ) as HTMLAnchorElement,
    repeated: document.querySelector(
      "button[data-glossanchor-entry]",
    ) as HTMLButtonElement,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("enhanceGlossaryInteractions", () => {
  it("opens a definition without following an ordinary anchor click", () => {
    const { definition, first } = renderFixture();
    const controller = enhanceGlossaryInteractions();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    expect(first.dispatchEvent(event)).toBe(false);
    expect(definition.hidden).toBe(false);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    controller.destroy();
  });

  it("preserves modified-link navigation", () => {
    const { definition, first } = renderFixture();
    const controller = enhanceGlossaryInteractions();
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });

    expect(first.dispatchEvent(event)).toBe(true);
    expect(definition.hidden).toBe(true);
    controller.destroy();
  });

  it("opens from repeated terms and closes on outside pointer input", () => {
    const { definition, repeated } = renderFixture();
    const controller = enhanceGlossaryInteractions();
    repeated.click();
    expect(definition.hidden).toBe(false);

    document
      .querySelector("[data-outside]")
      ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(definition.hidden).toBe(true);
    controller.destroy();
  });

  it("returns focus to the active trigger after Escape", () => {
    const { definition, repeated } = renderFixture();
    const controller = enhanceGlossaryInteractions();
    repeated.click();
    definition.focus();
    definition.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );

    expect(definition.hidden).toBe(true);
    expect(document.activeElement).toBe(repeated);
    controller.destroy();
  });

  it("loads an asynchronous definition and ignores stale results", async () => {
    const { definition, first } = renderFixture();
    let resolveRequest: ((value: string) => void) | undefined;
    const resolver = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const controller = enhanceGlossaryInteractions(document, {
      resolveDefinition: resolver,
    });
    first.click();
    expect(definition.getAttribute("aria-busy")).toBe("true");
    controller.close();
    resolveRequest?.("Updated asynchronously.");
    await Promise.resolve();

    expect(definition.textContent).not.toContain("Updated asynchronously.");
    controller.destroy();
  });

  it("applies a current asynchronous definition", async () => {
    const { definition, repeated } = renderFixture();
    const controller = enhanceGlossaryInteractions(document, {
      resolveDefinition: () => Promise.resolve("Updated asynchronously."),
    });
    repeated.click();
    await vi.waitFor(() => {
      expect(definition.textContent).toContain("Updated asynchronously.");
      expect(definition.hasAttribute("aria-busy")).toBe(false);
    });
    controller.destroy();
  });

  it("attaches without rewriting server-rendered markup", () => {
    renderFixture();
    const before = document.body.innerHTML;
    const controller = enhanceGlossaryInteractions();
    expect(document.body.innerHTML).toBe(before);
    controller.destroy();
  });

  it("removes all delegated behavior when destroyed", () => {
    const { definition, repeated } = renderFixture();
    const controller = enhanceGlossaryInteractions();
    controller.destroy();
    repeated.click();
    expect(definition.hidden).toBe(true);
  });
});
