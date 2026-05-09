import { SignJWT } from 'jose';

export async function POST(req: Request) {
  const form = await req.formData();

  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');

  if (
    email !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return Response.json({ error: 'Invalid login' }, { status: 401 });
  }

  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!));

  const isProd = process.env.NODE_ENV === 'production';

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${
        isProd ? '; Secure' : ''
      }`,
    },
  });
}