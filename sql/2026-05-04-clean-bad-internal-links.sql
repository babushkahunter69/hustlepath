-- Optional cleanup for early AI-generated links that pointed to posts that do not exist.
-- This keeps the visible anchor text but removes the bad /blog URL.

update posts
set body = regexp_replace(body, '\\[([^\\]]+)\\]\\(/blog/make-first-100-online\\)', '\\1', 'g'),
    updated_at = now()
where body like '%/blog/make-first-100-online%';

update posts
set body = regexp_replace(body, '\\[([^\\]]+)\\]\\(/blog/pinterest-blogging\\)', '\\1', 'g'),
    updated_at = now()
where body like '%/blog/pinterest-blogging%';

update posts
set body = regexp_replace(body, '\\[([^\\]]+)\\]\\(/blog/side-hustles-zero-dollars\\)', '\\1', 'g'),
    updated_at = now()
where body like '%/blog/side-hustles-zero-dollars%';
