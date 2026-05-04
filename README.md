# HustlePathDaily

Next.js blog with a simple admin panel, Neon-backed drafts, and AI daily draft generation.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env example:

```bash
cp .env.example .env.local
```

3. Fill in:

```env
DATABASE_URL=your_neon_connection_string
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
ADMIN_JWT_SECRET=a_long_random_secret
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
CRON_SECRET=optional_secret
```

4. Run the database schema in Neon:

```sql
-- db/schema.sql
```

5. Start locally:

```bash
npm run dev
```

Open `/admin/login` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Admin features

- Admin link in the main navigation
- Env-based login, no Neon admin user table needed
- Draft dashboard
- Draft queue
- Editor
- Publish and reject flow
- Manual `Generate draft now` button
- Vercel daily cron at `/api/cron/daily-draft`

## Vercel

Add the same env vars in Vercel, then redeploy. Vercel cron is configured in `vercel.json`.

## Security note

Do not commit `.env.local`. Rotate any keys that were shown in screenshots or shared publicly.
