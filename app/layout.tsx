import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "Hustle Path Daily | Beginner Income Guides",
  description:
    "Daily beginner-friendly guides for side hustles, Pinterest blogging, tools, and online income ideas.",
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