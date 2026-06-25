"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "About", href: "/" },
  { label: "Repository", href: "/repository", disabled: true },
  { label: "Download", href: "/download" },
  { label: "Help", href: "/help" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="header-title">
          NPdia
        </Link>

        <nav className="header-nav">
          {navLinks.map(({ label, href, disabled }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            if (disabled) {
              return (
                <span
                  key={href}
                  className="header-nav-link"
                  style={{
                    fontWeight: 400,
                    color: "#555577",
                    backgroundColor: "transparent",
                    cursor: "not-allowed",
                    userSelect: "none",
                  }}
                >
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className="header-nav-link"
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#ffffff" : "#a0a0c8",
                  backgroundColor: isActive
                    ? "rgba(100, 100, 220, 0.35)"
                    : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
