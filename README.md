# HustlePathDaily

Next.js blog with an env-based admin login, Neon-backed draft queue, editor, publish flow, SEO scoring, internal link suggestions, and daily AI draft generation.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these in `.env.local` and in Vercel Environment Variables:

```env
DATABASE_URL=your_neon_database_url
ADMIN_JWT_SECRET=long_random_secret
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=your_admin_password
OPENAI_API_KEY=your_openai_key
CRON_SECRET=optional_secret
AUTO_PUBLISH_DAILY_DRAFTS=false
```

## Neon setup

Run `db/schema.sql` in Neon SQL Editor.

## Admin

Go to `/admin/login`. The admin login uses `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Neon is used for posts and drafts only.

## Draft generation

Manual: click **Generate draft now** in `/admin` or `/admin/drafts`.

Cron: Vercel calls `/api/cron/daily-draft` based on `vercel.json`.

By default, AI drafts stay in `draft` status. To auto-publish only high-scoring drafts, set:

```env
AUTO_PUBLISH_DAILY_DRAFTS=true
```

Only generated drafts with SEO score 85+ are auto-published.
