"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/**
 * Shared state for the bidirectional gene ↔ reaction highlight link.
 *
 * `activeIds` holds all known identifiers (gene name + locus_tag) of the
 * gene that is currently hovered in either GeneLociMap or StepsTable.
 * An empty array means nothing is active.
 *
 * Components set `activeIds` from their own hover events and read it to
 * dim / highlight their own elements.
 */
interface GeneHighlightCtx {
  activeIds: string[];
  setActiveIds: (ids: string[]) => void;
}

const GeneHighlightContext = createContext<GeneHighlightCtx>({
  activeIds: [],
  setActiveIds: () => {},
});

export function GeneHighlightProvider({ children }: { children: ReactNode }) {
  const [activeIds, setActiveIds] = useState<string[]>([]);
  return (
    <GeneHighlightContext.Provider value={{ activeIds, setActiveIds }}>
      {children}
    </GeneHighlightContext.Provider>
  );
}

export function useGeneHighlight(): GeneHighlightCtx {
  return useContext(GeneHighlightContext);
}