export type ClusterSeed = {
  niche: string;
  category: string;
  pillarTitle: string;
  supportingTitles: string[];
};

export const contentClusters: ClusterSeed[] = [
  {
    niche: 'Pinterest traffic for beginner side hustle blogs',
    category: 'Pinterest',
    pillarTitle: 'How to Use Pinterest to Get Blog Traffic as a Beginner',
    supportingTitles: [
      'Pinterest SEO Tips for Beginner Bloggers',
      'Best Pinterest Niches for New Blog Traffic',
      'How to Create Pinterest Pin Titles That Get Clicks',
      'Pinterest Board Strategy for a New Blog',
      'How Many Pins Should a Beginner Create Per Blog Post',
    ],
  },
  {
    niche: 'beginner online income without an audience',
    category: 'Beginner Guide',
    pillarTitle: 'How to Make Your First Online Income Without an Audience',
    supportingTitles: [
      'Beginner Services You Can Sell Online With No Audience',
      'How to Package One Skill Into a Simple Freelance Offer',
      'Best Free Tools for Starting an Online Income Project',
      'How to Get Your First Client Without Paid Ads',
      'Simple Weekly Plan for Building an Online Income Stream',
    ],
  },
  {
    niche: 'AI tools for simple side hustles',
    category: 'Tools',
    pillarTitle: 'Best AI Tools for Starting a Simple Online Side Hustle',
    supportingTitles: [
      'How to Use AI to Plan a Beginner Side Hustle',
      'AI Writing Tools for Blog Posts, Pins, and Product Ideas',
      'Free AI Tools Beginners Can Use to Save Time',
      'How to Turn AI Research Into Helpful Blog Content',
      'AI Side Hustle Mistakes Beginners Should Avoid',
    ],
  },
];

export function getTodaysClusterSeed(date = new Date()) {
  return contentClusters[date.getUTCDate() % contentClusters.length];
}

export function getClusterTopics(seed: ClusterSeed) {
  return [seed.pillarTitle, ...seed.supportingTitles].map((title, index) => ({
    title,
    category: seed.category,
    niche: seed.niche,
    clusterRole: index === 0 ? 'pillar' : 'supporting',
  }));
}
