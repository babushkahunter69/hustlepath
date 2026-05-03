const fs = require("fs");
const path = require("path");

const title = process.argv.slice(2).join(" ");

if (!title) {
  console.log("Usage: npm run new-post -- Your Post Title");
  process.exit(1);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const slug = slugify(title);
const date = new Date().toISOString().split("T")[0];
const dir = path.join(process.cwd(), "content/posts");

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const template = `---
title: "${title}"
slug: "${slug}"
excerpt: "A practical beginner-friendly guide to ${title.toLowerCase()}."
category: "Beginner Guide"
date: "${date}"
seoTitle: "${title} | HustlePath"
seoDescription: "Learn ${title.toLowerCase()} with this simple beginner-friendly guide."
---

## Introduction

Write a clear opening that explains the problem and who this guide is for.

## What this means

Explain the topic in simple terms.

## Step 1: Start with the basics

Give the reader one clear first action.

## Step 2: Keep it simple

Avoid overwhelming the reader.

## Step 3: Take action

Show them what to do next.

## Common mistakes

- Trying too many things at once
- Buying tools before having a plan
- Quitting before testing properly

## Final thoughts

End with a practical takeaway.
`;

const filePath = path.join(dir, `${slug}.md`);
fs.writeFileSync(filePath, template);
console.log(`Created: content/posts/${slug}.md`);
