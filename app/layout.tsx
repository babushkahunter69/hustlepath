import './globals.css';

export const metadata = {
  title: 'Hustle Path Daily',
  description: 'Daily ideas for building your first online income stream.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-nav">
            <a href="/" className="logo">Hustle Path Daily<span>.</span></a>
            <div className="nav-links">
              <a href="/">Home</a>
              <a href="/blog">Blog</a>
              <a href="/topics">Topics</a>
              <a href="/newsletter">Newsletter</a>
              <a href="/admin" className="admin-link">Admin</a>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
