# Lynky

Lynky is an open-source URL cleaner and shortener designed to make shared links simpler, cleaner, and less intrusive.

## Overview

Lynky removes known tracking parameters and unnecessary URL baggage before generating a compact link that is easier to share.

The internet does not operate under one universal standard of privacy, consent, or data protection. Privacy laws differ between countries and regions, and their enforcement differs as well. A surprising amount of information can travel through the links people share: campaign identifiers, referral information, advertising IDs, analytics parameters, tracking tokens, and other metadata not necessary to reach the content itself. Lynky cleans a URL before it is shared, removes known tracking and unnecessary parameters where they can be safely identified, and produces a short link containing only what is necessary to redirect to the cleaned destination. The result is a link that is easier to read, easier to share, and less likely to expose unnecessary tracking information. Short links also avoid filling conversations with excessively long URLs and can reduce unwanted automatic link previews.

Both the frontend and backend source code are publicly available for inspection so that Lynky's behavior can be reviewed rather than simply trusted.

Lynky focuses specifically on information that can be identified and removed at the URL level. It cannot prevent a destination website or application from collecting information after you visit it, including cookies, browser or device fingerprinting, IP-based identification, server-side analytics, authenticated account activity, tracking scripts, request headers, or other tracking mechanisms outside the URL itself. Lynky should be considered a URL-cleaning and link-sharing privacy tool, not a complete anonymity or anti-tracking system.

Lynky is currently in beta. Features, APIs, cleaning rules, infrastructure, and behavior may change. Bugs, outages, incorrect cleaning behavior, and other unexpected issues may occur. Use the service accordingly, particularly when a URL contains important functional parameters.

## Requirements

- Node.js 20.19+ or 22.12+ (Vite 8 requirement)
- MongoDB instance (backend uses Mongoose)
- Environment variables (see Configuration)

## Getting Started

Backend:

```sh
cd backend
cp .env.example .env
npm install
npm run dev
```

Frontend:

```sh
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Configuration

Backend environment variables (see `backend/.env.example`):

- `MONGODB_URI` - MongoDB connection string (required)
- `PORT` - server port (default `5001`)
- `NODE_ENV` - `development` (default), `test`, or `production`
  (case-insensitive)
- `FRONTEND_URL` - allowed frontend origin; required when
  `NODE_ENV=production`
- `PUBLIC_URL` - public base URL for generated short links (required)
- `ENCRYPTION_KEY` - encryption key (required)
- `EXPIRATION_DAYS` - link lifetime in days (required)
- `MAX_URL_LENGTH` - maximum accepted URL length (default `640`)
- `MIN_CODE_LENGTH`, `MAX_CODE_LENGTH` - shortcode length bounds
  (defaults `4`/`6`)
- `MAX_CODE_ATTEMPTS` - shortcode generation retry limit (default `10`)
- `API_KEY_LENGTH` - generated API key length (default `45`, minimum `16`)
- `API_KEY_MONTHLY_LIMIT` - monthly API key usage limit (default `10000`)

Frontend environment variables (see `frontend/.env.example`):

- `VITE_API_URL` - backend API base URL, including `/api/v1`
- `VITE_IOS_SHORTCUT` - iOS shortcut URL
- `VITE_API_KEY_MONTHLY_LIMIT` - quota label shown in the API docs
  (default `10000`)

## How It Works

- Removes known tracking parameters from supported URLs.
- Strips unnecessary URL parameters where they can be safely identified.
- Preserves parameters and URL fragments that may be required for the destination to function correctly.
- Produces short, simple, shareable links.
- Automatically expires shortened links after their configured lifetime.
- Does not intentionally append its own advertising or tracking parameters.
- Requires no account for normal use.
- Makes both frontend and backend source code available for inspection.
- Keeps the sharing experience simple and intentionally minimal.

Lynky's cleaning rules are loaded from configuration files under `backend/config/` (tracking rules, ClearURLs data, URL cleaner). Shortcodes are generated and stored in MongoDB; redirects resolve the shortcode to the cleaned destination.

## Deployment

Frontend is built with Vite and can be deployed to Vercel (uses
`@vercel/analytics`). The build requires `VITE_API_URL`. Backend is a
Node/Express service built with `tsc`; the build also copies `config/` into
`dist/`, and the service runs via `node dist/src/server.js`. MongoDB is
required. (Specific hosting setup TBD.)

## Troubleshooting

- `VITE_API_URL is required` during frontend dev/build: copy
  `frontend/.env.example` to `frontend/.env.local` and set the API base URL.
- `Tracking config file not found`: run `npm run build` in `backend/` (it copies
  `config/` into `dist/`) or start the server from `backend/`.
- `Database is unavailable`: check `MONGODB_URI`; API routes return `503` until
  MongoDB is reachable.

## Tests & Scripts

Backend scripts:

- `npm run dev` - run backend in watch mode (tsx)
- `npm run build` - compile TypeScript and copy `config/` into `dist/`
- `npm run start` - run compiled server
- `npm test` - run backend tests (Node test runner). Database integration tests
  run when `TEST_MONGODB_URI` is set; CI provides MongoDB.
- `npm run provision:keys` - provision API keys
- `npm run migrate:urlhash` - migrate URL hash uniqueness

Frontend scripts:

- `npm run dev` - Vite dev server
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm test` - run frontend tests (Node test runner)
- `npm run preview` - preview production build

## Security

- 2026-10-31: backend `npm audit --omit=dev` reports 0 vulnerabilities.
  Frontend `npm audit --audit-level=high` reports 0 high/critical findings;
  6 moderate advisories remain in the development-only ESLint/minimatch chain.
- Verified: `npx tsc --noEmit`, backend/frontend `npm test`, `npm run lint`,
  and `npm run build` pass.

## Languages Used

- TypeScript (backend)
- JavaScript/TypeScript + React (frontend)
- Tailwind CSS

## License

Lynky is source-available for personal and non-commercial use. Commercial use requires a separate paid commercial license and prior written authorization. See [LICENSE.md](./LICENSE.md) for the complete license, restrictions, warranty disclaimer, and limitation of liability.

## About
Lynky is an open-source URL cleaner and shortener.


Proudly made in Mumbai by Harsh Sanket.
GPT 6.1 Sol by OpenAI was used for development.

For queries, suggestions, or contributions, feel free to reach out: harshsanket.dev@gmail.com

## Acknowledgments
Kevin Roebert / ClearURLs - for the ClearURLs project and its work on identifying and maintaining URL tracking-parameter rules.
Vercel - application hosting and deployment infrastructure.
MongoDB - database infrastructure.

---

a **Harsh Sanket** production