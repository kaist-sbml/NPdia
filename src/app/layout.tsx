import type { Metadata } from "next";
import Header from "@/components/Header";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "NPdia",
  description: "Curated T1PKS and NRPS biosynthesis pathway database",
  icons: {
    icon: "/image/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="page-main">{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/image/kaist_logo.png"
              alt="KAIST"
              style={{ height: 42, width: "auto", objectFit: "contain" }}
            />
            <div className="footer-divider" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/image/snu_ui_download.png"
              alt="Seoul National University"
              style={{ height: 72, width: "auto", objectFit: "contain" }}
            />
            <div className="footer-divider" />
            {/* DTU is a tall vertical mark; 72px shows the full DTU text + waves */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/image/DTU_Logo_Corporate_Red_RGB.png"
              alt="Technical University of Denmark"
              style={{ height: 72, width: "auto", objectFit: "contain" }}
            />
            <div className="footer-divider" />
            {/* SBML has significant built-in whitespace; 76px keeps visual parity */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/image/SBML.png"
              alt="Systems Biology and Medicine Lab"
              style={{ height: 76, width: "auto", objectFit: "contain" }}
            />
          </div>
          <div className="footer-copyright">
            NPdia is licensed under a{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
              Creative Commons Attribution 4.0 International License (CC BY 4.0)
            </a>
            . 
          </div>
          <div className="footer-collaborators">
            © 2026 Systems Biology and Medicine Laboratory, KAIST.
          </div>
        </footer>
      </body>
    </html>
  );
}