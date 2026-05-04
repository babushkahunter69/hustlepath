const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js you@example.com your-password');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to .env.local or export it in your shell.');
  process.exit(1);
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const passwordHash = await bcrypt.hash(password, 10);

  await sql`
    insert into admin_users (email, password_hash)
    values (${email.toLowerCase()}, ${passwordHash})
    on conflict (email) do update set password_hash = excluded.password_hash
  `;

  console.log(`Admin user ready: ${email.toLowerCase()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
