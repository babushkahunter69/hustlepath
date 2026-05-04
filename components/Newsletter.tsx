export default function Newsletter() {
  return (
    <section id="newsletter" className="newsletter-band">
      <div className="newsletter-grid">
        <div>
          <p className="eyebrow">Weekly Starter Ideas</p>
          <h2>Get one practical income idea every week.</h2>
          <p>No hype. No spam. Just useful guides, tools, and simple online income ideas.</p>
        </div>

        <form className="newsletter-form">
          <input type="email" placeholder="Enter your email" />
          <button type="submit">Join free</button>
        </form>
      </div>
    </section>
  );
}
