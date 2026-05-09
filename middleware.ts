import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (!path.startsWith('/admin')) return NextResponse.next();
  if (path === '/admin/login') return NextResponse.next();

  const token = req.cookies.get('admin_session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  try {
    await jwtVerify(
      token,
      new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    );

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};