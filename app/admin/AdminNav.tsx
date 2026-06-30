import Link from 'next/link';

const ITEMS = [
  { href: '/admin', label: 'Dashboard', key: 'dashboard' },
  { href: '/admin/articles', label: 'Articles', key: 'articles' },
  { href: '/admin/design-library', label: 'Design Library', key: 'design-library' },
  { href: '/admin/pins', label: 'Pinterest', key: 'pinterest' },
  { href: '/admin/social-campaigns', label: 'Social Campaigns', key: 'social-campaigns' },
] as const;

export default function AdminNav({ current }: { current: string }) {
  return (
    <nav className="admin-actions" aria-label="Admin navigation">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={item.key === current ? 'primary-link small' : 'secondary-link small'}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
