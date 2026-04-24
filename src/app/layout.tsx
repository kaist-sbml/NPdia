import type { Metadata } from "next";
import Header from "@/components/Header";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "NPdia",
  description: "Curated T1PKS and NRPS biosynthesis pathway database",
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
            {/* SBML has significant built-in whitespace; 84px renders visually
                similar in height to the KAIST wordmark at 42px */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/image/SBML.png"
              alt="Systems Biology and Medicine Lab"
              style={{ height: 84, width: "auto", objectFit: "contain" }}
            />
          </div>
          <div className="footer-copyright">
            Copyright &copy; 2026 NPdia Project. All rights reserved.
          </div>
          <div className="footer-collaborators">
            Developed by{" "}
            <a href="https://sbml.kaist.ac.kr/" target="_blank" rel="noreferrer">
              KAIST SBML
            </a>
            {" "}in collaboration with SNU and DTU.
          </div>
        </footer>
      </body>
    </html>
  );
}
