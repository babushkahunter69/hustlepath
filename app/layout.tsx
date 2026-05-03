import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "Hustle Path Daily",
  description:
    "Daily ideas, side hustles, and beginner-friendly ways to make money online.",
  metadataBase: new URL("https://hustlepathdaily.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}