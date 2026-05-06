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
              padding: "28px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/"
              style={{
                color: "#111",
                fontWeight: 900,
                fontSize: "24px",
                textDecoration: "none",
              }}
            >
              HustlePathDaily<span style={{ color: "#f04b18" }}>.</span>
            </Link>

            <nav
              style={{
                display: "flex",
                gap: "32px",
                alignItems: "center",
              }}
            >
              {[
                ["Home", "/"],
                ["Blog", "/blog"],
                ["Topics", "/category"],
                ["Newsletter", "/newsletter"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    color: "#111",
                    fontWeight: 800,
                    textDecoration: "none",
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}