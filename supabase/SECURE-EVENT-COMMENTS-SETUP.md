# Secure event comments

Run `events.sql` in the Supabase SQL Editor to enable the comment controls and protections. It is safe to rerun on an existing events installation.

The same migration adds `media_urls` to posts and drafts, backfills existing single-media posts, and sets a 10-file maximum. Apply it before deploying the carousel UI. Admins can select up to 10 photos or one video; visitors can swipe or use the arrows and dots to navigate photos.

The site posts comments and reports through the `/api/event-comments` serverless function. Configure `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) as a server-side Vercel environment variable and redeploy. Do not expose this key in browser code. The function reads the last IP in Vercel's `x-forwarded-for` header (or `x-real-ip` when unavailable); if the host provides neither, comment actions fail closed rather than bypass rate limits.

Public comments are limited to three per IP address per ten minutes. Reports are limited to five per IP address per hour, and the same address can report a specific comment only once. The database stores keyed hashes rather than raw IP addresses and prunes rate-limit records older than 24 hours.

Comments appear immediately. An administrator signed in on `events.html` can see report counts and remove reported comments. Visitors can report a comment from its `Report` action. Comment threads show the latest five comments first and allow older comments to be expanded.
