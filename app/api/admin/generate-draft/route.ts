import { redirect } from 'next/navigation';
import { generateDailyDraft } from '@/lib/draft-generator';

export async function POST() {
  const post = await generateDailyDraft();
  redirect(`/admin/drafts/${post.id}`);
}
