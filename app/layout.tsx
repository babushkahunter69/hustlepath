import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hustle Path Daily",
    template: "%s | Hustle Path Daily",
  },
  description:
    "Hustle Path Daily shares beginner-friendly online income guides, Pinterest growth strategies, side hustle ideas, and practical ways to start making money online without hype.",
  keywords: [
    "online income",
    "side hustles",
    "Pinterest marketing",
    "make money online",
    "beginner income guides",
    "Redbubble",
    "print on demand",
    "Pinterest SEO",
  ],
  metadataBase: new URL("https://hustlepathdaily.com"),
  openGraph: {
    title: "Hustle Path Daily",
    description:
      "Beginner-friendly online income guides, Pinterest strategies, and practical side hustle ideas.",
    url: "https://hustlepathdaily.com",
    siteName: "Hustle Path Daily",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hustle Path Daily",
    description:
      "Beginner-friendly online income guides, Pinterest strategies, and practical side hustle ideas.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}