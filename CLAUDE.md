# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — ESLint over the whole repo (flat config in `eslint.config.js`)

There is no test runner configured.

## Environment

Supabase credentials are required to boot the app — `src/lib/supabase.js` throws on missing env vars. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Architecture

DraftBird is a single-page Twitter/X-style **content approval queue** for two artifact types — short "tweets" (with media + threaded comments) and long-form "articles" (TipTap rich text). Reviewers walk a `pending → approved | rejected` workflow on each item, with undo.

### Layering

There are effectively three layers, and the boundaries matter:

1. **`src/lib/supabase.js`** — singleton Supabase client. Vite env vars only; if migrated to Next.js, this file and `.env` key names both need to change (see comments in the file).
2. **`src/lib/api.js`** — every Supabase call the UI makes. Pure async functions returning plain data; no React. Embedded selects fetch related rows in one round-trip (e.g. `getTweets` returns each tweet with `author`, `media`, and `comments` nested, sorted in JS before return). All mutations call `supabase.auth.getUser()` themselves rather than trusting a passed-in id. **Add new data access here, not in components.**
3. **`src/App.jsx`** — the entire UI. ~2500 lines, intentionally one file. The default export `App` owns all top-level state (session, me, profiles, tweets, articles, bookmarks, view, modals, toast, lightbox). Everything else in the file is a presentational component that receives props + callbacks.

Two small components live outside `App.jsx`: `src/components/Logo.jsx` and `src/components/CropModal.jsx` (the X-style image crop UI built on `react-easy-crop`).

### Data flow patterns to preserve

- **Optimistic updates with rollback.** `handleApprove`, `handleReject`, `handleUndo`, `handleSave`, and the article equivalents all snapshot prior state, apply the change locally, then revert + toast on API failure. Match this pattern when adding new mutations.
- **Refetch after writes that affect embedded rows.** `postTweet`, `addComment`, and `postArticle` refetch the full list rather than splicing, because the server-side embed (author/media/comments) is the source of truth for shape.
- **Realtime → debounced refetch.** `api.subscribeToFeed` listens on `tweets`, `tweet_comments`, `tweet_media`, `articles`. The handler in `App` debounces 300ms then refetches both lists. **Don't try to merge realtime payloads into state directly** — the payload doesn't include joined rows.
- **Urgent-post side channel.** Inside the same realtime handler, an `INSERT` on `tweets` with `urgent=true` from another user triggers a toast + Web `Notification`. Permission state is tracked in `notifPermission` with an in-feed banner to request it.
- **`meRef`/`profilesRef`.** The realtime handler reads these refs instead of closing over state, so the subscription doesn't need to be torn down on every profile update. Mirror this if you add other long-lived subscriptions.

### Storage layout

Supabase Storage uses two buckets:
- `avatars` — path `{userId}/avatar.{ext}`, upserted. URLs are cache-busted with `?t={timestamp}`.
- `tweet-media` — path `{userId}/{tweetId}/{index}-{timestamp}.{ext}`. Article cover images also go here under `{userId}/article-cover-{timestamp}.{ext}`. Tweet media upload rolls back the parent tweet row on failure.

### Tweet composer specifics

`InlineComposer` and `ComposerModal` keep media as `{ file, originalFile, previewUrl, type, aspectRatio, altText, aspectMode }`. `originalFile` is the uncropped source so re-opening the crop modal starts from the original. `previewUrl` is an object URL — always revoke it on removal and on unmount. Cropped output is a `Blob` (no `.name`); `api.postTweet` handles that by generating a fallback filename.

### Articles

Articles use TipTap (`StarterKit + Placeholder + Image`). The same DOM string is shown in `ArticleReader` via `dangerouslySetInnerHTML` and re-styled via the `.article-body` rules in `src/index.css` — that selector intentionally applies to both rendered output and the editor. Keep new article styling there, not inline.

### Styling

Tailwind v3 + heavy inline `style` for the X color palette (`#000`, `#e7e9ea`, `#71767b`, `#2f3336`, `#1d9bf0`, `#00ba7c`, `#f4212e`, `#ef4444` for urgent steady-state indicators, `#a855f7` reserved for the realtime "new urgent" toast/notification, `#ffd400` for note/bookmark). New UI should reuse those exact tokens to stay visually consistent.
