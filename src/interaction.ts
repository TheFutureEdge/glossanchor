export type GlossaryDefinitionContent = Node | string | null | undefined;

export interface GlossaryDefinitionRequest {
  definition: HTMLElement;
  entryId: string;
  trigger: HTMLElement;
}

export interface GlossaryInteractionOptions {
  onDefinitionError?: (
    error: unknown,
    request: GlossaryDefinitionRequest,
  ) => void;
  resolveDefinition?: (
    request: GlossaryDefinitionRequest,
  ) => GlossaryDefinitionContent | Promise<GlossaryDefinitionContent>;
}

export interface GlossaryInteractionController {
  close: () => void;
  destroy: () => void;
}

type InteractionRoot = Document | HTMLElement;

const triggerSelector = "[data-glossanchor-entry]";

function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function isPlainPrimaryClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

function findDefinition(trigger: HTMLElement): HTMLElement | null {
  const id = trigger.getAttribute("aria-describedby");
  return id === null ? null : trigger.ownerDocument.getElementById(id);
}

function setExpanded(
  definitionId: string,
  root: InteractionRoot,
  value: boolean,
) {
  const triggers: NodeListOf<Element> = root.querySelectorAll(triggerSelector);
  for (const trigger of Array.from(triggers)) {
    if (!(trigger instanceof HTMLElement)) continue;
    if (trigger.getAttribute("aria-describedby") === definitionId) {
      trigger.setAttribute("aria-expanded", String(value));
    }
  }
}

function setDefinitionContent(
  definition: HTMLElement,
  content: GlossaryDefinitionContent,
): void {
  if (content === null || content === undefined) return;
  const container = definition.querySelector<HTMLElement>(
    "[data-glossanchor-definition-content]",
  );
  if (container === null) return;

  container.replaceChildren(
    typeof content === "string"
      ? definition.ownerDocument.createTextNode(content)
      : content,
  );
}

export function enhanceGlossaryInteractions(
  root: InteractionRoot = document,
  options: GlossaryInteractionOptions = {},
): GlossaryInteractionController {
  let activeDefinition: HTMLElement | null = null;
  let activeTrigger: HTMLElement | null = null;
  let destroyed = false;
  let requestVersion = 0;

  const close = (restoreFocus = false): void => {
    requestVersion += 1;
    if (activeDefinition === null) return;

    const definition = activeDefinition;
    const trigger = activeTrigger;
    definition.hidden = true;
    definition.removeAttribute("aria-busy");
    setExpanded(definition.id, root, false);
    activeDefinition = null;
    activeTrigger = null;
    if (restoreFocus) trigger?.focus();
  };

  const open = (trigger: HTMLElement, focusDefinition: boolean): void => {
    const definition = findDefinition(trigger);
    if (definition === null) return;

    if (activeDefinition !== definition) close();
    activeDefinition = definition;
    activeTrigger = trigger;
    definition.hidden = false;
    setExpanded(definition.id, root, false);
    trigger.setAttribute("aria-expanded", "true");

    if (focusDefinition) {
      const focusTarget =
        definition.querySelector<HTMLElement>(
          "a[href], button, [tabindex='0']",
        ) ?? definition;
      focusTarget.focus();
    }

    if (options.resolveDefinition === undefined) return;
    const currentRequest = ++requestVersion;
    const request = {
      definition,
      entryId: trigger.dataset.glossanchorEntry ?? "",
      trigger,
    };
    definition.setAttribute("aria-busy", "true");
    void Promise.resolve(options.resolveDefinition(request))
      .then((content) => {
        if (
          destroyed ||
          currentRequest !== requestVersion ||
          activeDefinition !== definition
        ) {
          return;
        }
        setDefinitionContent(definition, content);
      })
      .catch((error: unknown) => {
        options.onDefinitionError?.(error, request);
      })
      .finally(() => {
        if (currentRequest === requestVersion) {
          definition.removeAttribute("aria-busy");
        }
      });
  };

  const onClick = (event: Event): void => {
    if (!(event instanceof MouseEvent) || !isPlainPrimaryClick(event)) return;
    const trigger =
      asElement(event.target)?.closest<HTMLElement>(triggerSelector) ?? null;
    if (
      trigger === null ||
      !root.contains(trigger) ||
      findDefinition(trigger) === null
    ) {
      return;
    }

    if (trigger instanceof HTMLAnchorElement) event.preventDefault();
    open(trigger, event.detail === 0);
  };

  const onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Escape") return;
    if (activeDefinition !== null) {
      event.preventDefault();
      close(true);
    }
  };

  const onPointerDown = (event: Event): void => {
    const target = asElement(event.target);
    if (
      activeDefinition !== null &&
      target !== null &&
      !activeDefinition.contains(target) &&
      !activeTrigger?.contains(target)
    ) {
      close();
    }
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("pointerdown", onPointerDown);

  return {
    close,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      close();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("pointerdown", onPointerDown);
    },
  };
}
