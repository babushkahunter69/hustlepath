import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Hustle Path Daily',
  description: 'Daily ideas for building your first online income stream.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
