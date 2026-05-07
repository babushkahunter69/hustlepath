import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hustle Path Daily",
    template: "%s | Hustle Path Daily",
  },
  description:
    "Beginner-friendly guides for online income, Pinterest growth, side hustles, and practical ways to start making money online.",
  metadataBase: new URL("https://hustlepathdaily.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header
  style={{
    borderBottom: "1px solid #ded6ca",
    background: "#f5efe5",
  }}
>
  <div
    style={{
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "20px 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "20px",
    }}
  >
    <a
      href="/"
      style={{
        color: "#111",
        fontWeight: 900,
        fontSize: "22px",
        lineHeight: 1,
        letterSpacing: "-0.04em",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      HustlePathDaily<span style={{ color: "#f04b18" }}>.</span>
    </a>

    <nav
      style={{
        display: "flex",
        gap: "18px",
        alignItems: "center",
        fontSize: "14px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>Home</a>
      <a href="/blog" style={{ color: "#111", textDecoration: "none" }}>Blog</a>
      <a href="/category" style={{ color: "#111", textDecoration: "none" }}>Topics</a>
      <a href="/newsletter" style={{ color: "#111", textDecoration: "none" }}>Newsletter</a>
    </nav>
  </div>
</header>

        {children}
      </body>
    </html>
  );
}