# AI Thomas Research Mentor

AI Thomas is a research mentor workspace grounded in a local Thomas K. F. Chiu literature corpus. It is designed to help users discuss research ideas, paragraph drafts, variable models, and paper plans; it does not simulate or represent Thomas K. F. Chiu as a person.

## Public GitHub Version

This repository is safe to publish because it excludes:

- DeepSeek / ModelScope API keys and `.env`
- PDF files
- full-text extracted paper chunks
- reviewer manuscripts

The GitHub Pages frontend in `docs/` calls the protected Cloudflare Worker backend. The Worker keeps the ModelScope token private, stores anonymous visitor conversations in Cloudflare KV, and enforces hard request limits before calling ModelScope.

## Current Corpus Boundary

- 38 downloaded Thomas first-author PDFs are used as the core local corpus.
- 12 downloaded Web of Science corresponding-author PDFs are used as expansion evidence.
- 6 Thomas first-author papers and 22 corresponding-author candidates are tracked as pending/missing.
- `REL01` Fu (2025), `REL02` Liu et al. (2025), and `M01` AERE reviewer manuscript are explicitly excluded from AI Thomas evidence.

## Local Retrieval Design

- Full-text paper evidence is split into overlapping local chunks of about 950 characters.
- Neighboring paper chunks carry about 180 characters of overlap, so concepts and claims are less likely to be cut apart.
- Each answer retrieves up to 12 relevant chunks, with at most 3 chunks from the same paper, before calling DeepSeek.

## Research Workflows

The frontend includes five workflow templates: research matrix, concept boundary, variable model, paper pipeline, and paragraph feedback. Each workflow fills a structured prompt, sets the matching research mode, and sends a `workflow` id to `/api/chat`. The backend keeps plain chat backward-compatible while adding workflow-specific output requirements such as tables, actionable steps, research mentor rationale, and evidence boundaries.

## Anonymous Guest Sessions

AI Thomas defaults to anonymous guest workspaces. With `ACCESS_MODE=anonymous`, anyone with the link can use the app without signing in. The backend creates a secure `ai_thomas_session` cookie for each browser profile and stores that visitor's conversations under `.data/conversations/<anonymousUserId>/`, so one visitor cannot list, read, delete, or continue another visitor's chat history.

Anonymous identity is browser-cookie based: clearing cookies, using private browsing, or changing devices creates a new workspace. If invite-only accounts are needed later, set `ACCESS_MODE=login` and manage accounts locally on the server:

```bash
node scripts/user-admin.js add <username> [display name]
node scripts/user-admin.js reset-password <username>
node scripts/user-admin.js list
```

Account passwords are stored with salted `PBKDF2-SHA256` hashes. All sessions use the `ai_thomas_session` cookie with `HttpOnly`, `SameSite=Lax`, and `Secure` when served over HTTPS or when `COOKIE_SECURE=true`.

## Local Development

```bash
cp .env.example .env
npm start
```

Required environment variables:

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
HOST=127.0.0.1
PORT=8787
MAX_REQUESTS_PER_HOUR=4
MAX_REQUESTS_PER_DAY=12
MAX_GLOBAL_REQUESTS_PER_DAY=30
MAX_ESTIMATED_TOKENS_PER_MONTH=500000
ACCESS_MODE=anonymous
SESSION_SECRET=...
SESSION_TTL_DAYS=7
ANONYMOUS_TTL_DAYS=30
COOKIE_SECURE=true
```

## DeepSeek Safety Limits

The backend enforces conservative usage limits before calling DeepSeek:

- 4 requests per hour per anonymous visitor or signed-in user
- 12 requests per day per anonymous visitor or signed-in user
- 30 requests per day globally
- 500,000 estimated tokens per month globally

Usage counters are stored in `.data/usage-limits.json`. On Aliyun, `.data/` is symlinked to shared storage so deployments do not reset the counters.

## GitHub Pages + Cloudflare Worker

Use `docs/` as the GitHub Pages source for the public static app. `docs/config.js` points the frontend to:

```js
window.AI_THOMAS_API_BASE = "https://ai-thomas-modelscope-api.xinyanzjo.workers.dev";
```

Worker deployment uses `wrangler.toml`, Cloudflare KV, and a secret named `MODELSCOPE_API_KEY`. The token is not committed to GitHub. Current Worker safety limits are:

- 8 requests per hour per anonymous visitor
- 20 requests per day per anonymous visitor
- 300 requests per day globally
- 2,000 ModelScope free daily calls as a hard upper guard
