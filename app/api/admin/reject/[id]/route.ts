import { sql } from '@/lib/db';
import { redirect } from 'next/navigation';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await sql`
    update posts
    set status = 'rejected', updated_at = now()
    where id = ${id}
  `;

  redirect('/admin/drafts');
}
