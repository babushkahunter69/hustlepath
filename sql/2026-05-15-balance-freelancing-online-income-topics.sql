-- Adds more draft-generation topics for underrepresented categories.
-- Run this once in Neon if you want the next generated drafts to focus more on
-- Freelancing and Beginner Online Income.

insert into topic_bank (topic, category)
values
  ('how to choose your first online income path as a beginner', 'Beginner Online Income'),
  ('how to make your first online income plan for the next 30 days', 'Beginner Online Income'),
  ('online income skills beginners can practice for free', 'Beginner Online Income'),
  ('how to compare beginner online income ideas without getting overwhelmed', 'Beginner Online Income'),
  ('how to avoid shiny object syndrome when starting online income', 'Beginner Online Income'),
  ('how to turn a small skill into your first online income project', 'Beginner Online Income'),
  ('best low risk online income ideas for complete beginners', 'Beginner Online Income'),
  ('simple online income ideas for beginners who hate social media', 'Beginner Online Income'),
  ('how to build an online income routine around a full time job', 'Beginner Online Income'),
  ('how to pick between blogging freelancing and digital products', 'Beginner Online Income'),
  ('freelance services beginners can offer without a degree', 'Freelancing'),
  ('how to create your first freelance package in one afternoon', 'Freelancing'),
  ('how to send a simple cold email for freelance work', 'Freelancing'),
  ('how to make a freelance portfolio from practice projects', 'Freelancing'),
  ('beginner freelance mistakes that make clients ignore you', 'Freelancing'),
  ('how to turn content writing into a beginner freelance service', 'Freelancing'),
  ('how to offer simple virtual assistant services as a beginner', 'Freelancing'),
  ('how to write your first freelance services page', 'Freelancing'),
  ('how to find freelance clients using local businesses', 'Freelancing'),
  ('how to follow up with freelance leads without feeling pushy', 'Freelancing')
on conflict (topic) do nothing;
