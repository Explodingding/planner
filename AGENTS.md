# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Prezentownik MVP — a React/TypeScript SPA for planning kids' birthday events. The frontend uses Vite; the backend is a single Netlify Function (`netlify/functions/events.ts`) backed by Netlify Blobs for storage. There is no traditional database.

### Running the dev environment

- **Full dev (frontend + serverless functions):** `netlify dev --offline`  
  Serves the SPA on **port 8888** and emulates Netlify Functions + Blobs locally. Use this for end-to-end testing.
- **Frontend only:** `npm run dev` — starts Vite on port 5173 (localStorage demo mode only; API calls to `/.netlify/functions/events` will fail).

### Quality checks

| Check | Command |
|-------|---------|
| Lint | `npm run lint` |
| Type-check + build | `npm run build` |
| Tests | `npm test` (Vitest; backend logic in `tests/events.test.ts`) |

Note: `tsc -b` does not type-check `netlify/functions/` — run `npx tsc --noEmit --strict --target es2023 --module esnext --moduleResolution bundler --skipLibCheck netlify/functions/*.ts` to verify functions separately.

### Key caveats

- `netlify dev --offline` is needed so the CLI doesn't require Netlify authentication. The `--offline` flag still emulates Blobs and Functions locally.
- The app is in Polish. UI labels, form fields, and error messages are all in Polish.
- The homepage (`/`) always renders the localStorage-backed demo. Online events live at `/event/:id` (public) and `/manage/:id?token=...` (organizer).
- Node.js is managed via nvm. Source nvm before running commands: `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`.
