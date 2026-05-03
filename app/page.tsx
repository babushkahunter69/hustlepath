import Hero from "@/components/Hero";
import TopicGrid from "@/components/TopicGrid";
import FeaturedPosts from "@/components/FeaturedPosts";
import Newsletter from "@/components/Newsletter";

export default function Home() {
  return (
    <main>
      <Hero />
      <TopicGrid />
      <FeaturedPosts />
      <Newsletter />
    </main>
  );
}
