import Hero from "@/components/Hero";
import TopicGrid from "@/components/TopicGrid";
import FeaturedPosts from "@/components/FeaturedPosts";
import Newsletter from "@/components/Newsletter";

export default function HomePage() {
  return (
    <main>

      {/* HERO */}
      <section className="section">
        <div className="container">
          <Hero />
        </div>
      </section>

      {/* FEATURED */}
      <section className="section-tight">
        <div className="container">
          <FeaturedPosts />
        </div>
      </section>

      {/* TOPICS */}
      <section className="section">
        <div className="container">
          <TopicGrid />
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="section">
        <div className="container">
          <Newsletter />
        </div>
      </section>

    </main>
  );
}