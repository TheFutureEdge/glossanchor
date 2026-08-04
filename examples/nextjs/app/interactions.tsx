"use client";

import { enhanceGlossaryInteractions } from "glossanchor/interaction";
import { useEffect } from "react";

export function GlossaryInteractions() {
  useEffect(() => {
    const controller = enhanceGlossaryInteractions(document);
    return () => controller.destroy();
  }, []);
  return null;
}
