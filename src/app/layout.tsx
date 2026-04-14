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
      </body>
    </html>
  );
}
