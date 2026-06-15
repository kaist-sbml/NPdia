"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "About", href: "/" },
  { label: "Repository", href: "/repository" },
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
          {navLinks.map(({ label, href }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
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
