export const metadata = {
  title: "Newsletter | Hustle Path Daily",
  description: "Join the Hustle Path Daily newsletter for practical beginner income ideas.",
};

export default function NewsletterPage() {
  return (
    <main className="bg-[#f7f1e8]">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-orange-600">Weekly starter ideas</p>
          <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">Get one practical income idea every week.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-black/60">No hype and no complicated funnels. Just simple guides, tools, and realistic steps for building your first online income stream.</p>
        </div>

        <form className="rounded-[2rem] border border-black/10 bg-white p-6 shadow-xl">
          <label className="block text-sm font-black text-black">Email address</label>
          <input type="email" placeholder="you@example.com" className="mt-3 w-full rounded-2xl border border-black/15 px-5 py-4 outline-none focus:border-black" />
          <button type="submit" className="mt-4 w-full rounded-full bg-black px-6 py-4 text-sm font-black text-white hover:bg-orange-600">Join free</button>
          <p className="mt-4 text-sm leading-6 text-black/50">You can connect this form to your email provider later. For now, it keeps the page from being a dead link.</p>
        </form>
      </section>
    </main>
  );
}
