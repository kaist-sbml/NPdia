import Link from "next/link";

export default function Header() {
  return (
    <header
      style={{
        padding: "16px 32px",
        borderBottom: "1px solid #ddd",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <h1 style={{ fontSize: "20px", margin: 0 }}>NRPS/PKS biosynthesis pathway encyclopedia (NPdia)</h1>

      <nav style={{ display: "flex", gap: "20px" }}>
        <Link href="/" style={{ textDecoration: "none", color: "#333" }}>
          About
        </Link>
        <Link href="/repository" style={{ textDecoration: "none", color: "#333" }}>
          Repository
        </Link>
        <Link href="/download" style={{ textDecoration: "none", color: "#333" }}>
          Download
        </Link>
      </nav>
    </header>
  );
}