export default function Newsletter() {
  return (
    <section id="newsletter" className="bg-[#111111] text-white">
      <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs tracking-[0.25em] text-orange-400 font-black mb-3">WEEKLY STARTER IDEAS</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Get one practical income idea every week.</h2>
          <p className="text-white/70 mt-4 leading-7">No hype. No spam. Just useful guides, tools, and simple online income ideas.</p>
        </div>
        <form className="bg-white rounded-3xl p-3 flex flex-col sm:flex-row gap-3">
          <input type="email" placeholder="Enter your email" className="flex-1 px-5 py-4 rounded-2xl text-black outline-none" />
          <button type="submit" className="bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-orange-700 transition">Join free</button>
        </form>
      </div>
    </section>
  );
}
