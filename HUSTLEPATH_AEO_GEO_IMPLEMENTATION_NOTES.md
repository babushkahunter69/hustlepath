# HustlePathDaily AEO/GEO Implementation Notes

Site focus checked before changes: HustlePathDaily is a beginner-friendly site about online income, side hustles, Pinterest traffic, freelancing, tools, Redbubble/print-on-demand, and practical first steps for making money online.

## Changes made

1. Article formatting now protects the site niche
   - Adds a `Quick Answer` section when missing.
   - Adds a `Beginner Action Plan` section when missing.
   - Adds a `Reality Check` section when missing.
   - Adds a FAQ section when missing.
   - Keeps the tone beginner-friendly and avoids guaranteed-income framing.

2. AI draft generation prompt updated
   - Requires HustlePath-specific structure.
   - Requires no fake income promises.
   - Requires no claims that beginners will definitely earn money.
   - Requires grounded cost, time, or risk notes when relevant.

3. SEO scoring updated
   - Checks for Quick Answer.
   - Checks for Beginner Action Plan.
   - Checks for Reality Check.
   - Keeps existing checks for FAQ, structure, bullets, internal links, and callouts.

4. Blog article schema upgraded
   - Adds Article schema.
   - Adds FAQPage schema when FAQs exist.
   - Adds LearningResource schema for beginner guides.
   - Adds BreadcrumbList schema.
   - Adds WebSite + SearchAction schema.
   - Adds Organization and Person schema.

## Validation

- TypeScript validation passed using `tsconfig.validate.json`, excluding scripts because the uploaded backup is missing the Playwright package used by `scripts/scrape-redbubble-products.ts`.
- Full `npm run build` was blocked because Next tried to download SWC and npm registry access is blocked in the sandbox.

## Files changed

- `lib/articleFormat.ts`
- `lib/aiDraft.ts`
- `lib/seo.ts`
- `app/blog/[slug]/page.tsx`
