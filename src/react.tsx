import {
  Fragment,
  useId,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { segmentGlossaryText } from "./core/matcher.js";
import type { GlossaryMatch, TextSegment } from "./core/types.js";

export interface GlossaryRenderContext<Metadata = unknown> {
  definitionId?: string;
  firstOccurrence: boolean;
  match: GlossaryMatch<Metadata>;
  occurrence: number;
}

export interface AnnotatedGlossaryTextProps<Metadata = unknown> {
  className?: string;
  definitionClassName?: string;
  definitionStyle?: CSSProperties;
  fullEntryLabel?: ReactNode;
  linkClassName?: string;
  linkRel?: string;
  linkStyle?: CSSProperties;
  linkTarget?: string;
  matches: readonly GlossaryMatch<Metadata>[];
  renderDefinition?: (
    context: GlossaryRenderContext<Metadata>,
    defaultDefinition: ReactElement,
  ) => ReactNode;
  renderFullEntryLink?: (
    context: GlossaryRenderContext<Metadata>,
    defaultLink: ReactElement,
  ) => ReactNode;
  renderText?: (segment: TextSegment<Metadata>) => ReactNode;
  renderTrigger?: (
    context: GlossaryRenderContext<Metadata>,
    defaultTrigger: ReactElement,
  ) => ReactNode;
  style?: CSSProperties;
  text: string;
  resolveHref?: (entry: GlossaryMatch<Metadata>["entry"]) => string | undefined;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
}

function normalizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/gu, "-");
}

export function AnnotatedGlossaryText<Metadata = unknown>({
  className,
  definitionClassName,
  definitionStyle,
  fullEntryLabel,
  linkClassName,
  linkRel,
  linkStyle,
  linkTarget,
  matches,
  renderDefinition,
  renderFullEntryLink,
  renderText,
  renderTrigger,
  style,
  text,
  resolveHref,
  triggerClassName,
  triggerStyle,
}: AnnotatedGlossaryTextProps<Metadata>): ReactElement {
  const componentId = normalizeIdPart(useId());
  const seenEntries = new Map<
    string,
    { definitionId?: string; count: number }
  >();
  const segments = segmentGlossaryText(text, matches);

  return (
    <span className={className} data-glossanchor-root="" style={style}>
      {segments.map((segment) => {
        if (segment.type === "text" || segment.match === undefined) {
          return (
            <Fragment key={`text-${segment.start}-${segment.end}`}>
              {renderText?.(segment) ?? segment.text}
            </Fragment>
          );
        }

        const { entry } = segment.match;
        const href =
          resolveHref === undefined ? entry.href : resolveHref(entry);
        const previous = seenEntries.get(entry.id);
        const firstOccurrence = previous === undefined;
        const occurrence = (previous?.count ?? 0) + 1;
        const hasDefinition =
          entry.definition !== undefined && entry.definition.trim().length > 0;
        const definitionId = firstOccurrence
          ? hasDefinition
            ? `glossanchor-${componentId}-${normalizeIdPart(entry.id)}`
            : undefined
          : previous.definitionId;
        seenEntries.set(entry.id, {
          ...(definitionId === undefined ? {} : { definitionId }),
          count: occurrence,
        });

        const context: GlossaryRenderContext<Metadata> = {
          ...(definitionId === undefined ? {} : { definitionId }),
          firstOccurrence,
          match: segment.match,
          occurrence,
        };
        const commonTriggerProps = {
          ...(definitionId === undefined
            ? {}
            : {
                "aria-describedby": definitionId,
                "aria-expanded": false,
                "aria-haspopup": "dialog" as const,
              }),
          className: triggerClassName,
          "data-glossanchor-entry": entry.id,
          "data-glossanchor-first": firstOccurrence ? "true" : "false",
          style: triggerStyle,
        };
        let defaultTrigger: ReactElement;

        if (firstOccurrence && href !== undefined) {
          defaultTrigger = (
            <a {...commonTriggerProps} href={href}>
              {segment.text}
            </a>
          );
        } else if (hasDefinition) {
          defaultTrigger = (
            <button {...commonTriggerProps} type="button">
              {segment.text}
            </button>
          );
        } else {
          defaultTrigger = <span {...commonTriggerProps}>{segment.text}</span>;
        }

        const trigger =
          renderTrigger?.(context, defaultTrigger) ?? defaultTrigger;
        let definition: ReactNode;
        if (firstOccurrence && hasDefinition && definitionId !== undefined) {
          let fullEntryLink: ReactNode;
          if (href !== undefined && fullEntryLabel !== undefined) {
            const defaultLink = (
              <a
                className={linkClassName}
                href={href}
                rel={
                  linkRel ??
                  (linkTarget === "_blank" ? "noopener noreferrer" : undefined)
                }
                style={linkStyle}
                target={linkTarget}
              >
                {fullEntryLabel}
              </a>
            );
            fullEntryLink =
              renderFullEntryLink?.(context, defaultLink) ?? defaultLink;
          }

          const defaultDefinition = (
            <span
              className={definitionClassName}
              data-glossanchor-definition=""
              hidden
              id={definitionId}
              aria-label={`${entry.label} definition`}
              role="dialog"
              style={definitionStyle}
              tabIndex={-1}
            >
              <span data-glossanchor-definition-content="">
                {entry.definition}
              </span>
              {fullEntryLink}
            </span>
          );
          definition =
            renderDefinition?.(context, defaultDefinition) ?? defaultDefinition;
        }

        return (
          <Fragment key={`match-${segment.start}-${segment.end}-${entry.id}`}>
            {trigger}
            {definition}
          </Fragment>
        );
      })}
    </span>
  );
}
