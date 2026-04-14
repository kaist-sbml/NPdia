"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  smiles: string;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
}

export default function MoleculeViewer({
  smiles,
  width = 420,
  height = 300,
  theme = "light",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!smiles || !containerRef.current) return;
    let cancelled = false;

    import("smiles-drawer").then((mod) => {
      if (cancelled) return;
      const SD = (mod as any).default ?? mod;
      const drawer = new SD.SvgDrawer({ width, height });

      SD.parse(
        smiles,
        (tree: unknown) => {
          if (cancelled || !containerRef.current) return;
          try {
            const svg = drawer.draw(tree, null, theme);
            // Force known size so the container doesn't collapse
            svg.setAttribute("width", String(width));
            svg.setAttribute("height", String(height));
            containerRef.current.innerHTML = "";
            containerRef.current.appendChild(svg);
            setError(null);
          } catch (e) {
            setError("Render error");
          }
        },
        (_err: unknown) => {
          if (!cancelled) setError("Invalid SMILES");
        }
      );
    });

    return () => { cancelled = true; };
  }, [smiles, width, height, theme]);

  if (error) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#aaa",
          fontSize: 12,
          gap: 8,
          backgroundColor: "#fafafa",
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: 28 }}>⚗</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width, height, lineHeight: 0 }}
    />
  );
}
