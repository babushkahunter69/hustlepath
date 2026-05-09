export const metadata = {
  title: "Newsletter | Hustle Path Daily",
  description: "Join the Hustle Path Daily newsletter for practical beginner income ideas.",
};

export default function NewsletterPage() {
  return (
    <main className="page-shell">
      <section className="newsletter-page">
        <div>
          <p className="eyebrow">Weekly Starter Ideas</p>
          <h1 className="page-title">Get one practical income idea every week.</h1>
          <p className="page-subtitle">
            No hype and no complicated funnels. Just simple guides, tools, and realistic steps for building your first online income stream.
          </p>
        </div>

        <form className="newsletter-signup-card">
          <label>Email address</label>
          <input type="email" placeholder="you@example.com" />
          <button type="submit">Join free</button>
          <p>You can connect this form to your email provider later. For now, it keeps the page from being a dead link.</p>
        </form>
      </section>
    </main>
  );
}
