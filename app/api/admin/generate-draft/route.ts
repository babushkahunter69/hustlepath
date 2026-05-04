import { generateDailyDraft } from '@/lib/aiDraft';
import { redirect } from 'next/navigation';

export async function POST() {
  const post = await generateDailyDraft();
  redirect(`/admin/drafts/${post.id}`);
}
