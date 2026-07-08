# Thomas Reasoning

AI Thomas is a research reasoning workbench distilled from a local Thomas K. F. Chiu literature corpus.

## Public GitHub Version

This repository is safe to publish because it excludes:

- DeepSeek API keys and `.env`
- PDF files
- full-text extracted paper chunks
- reviewer manuscripts

The GitHub Pages frontend in `docs/` calls the protected backend hosted on Aliyun. The backend keeps the DeepSeek key and full local corpus private.

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

The frontend includes five workflow templates: research matrix, concept boundary, variable model, paper pipeline, and paragraph feedback. Each workflow fills a structured prompt, sets the matching research mode, and sends a `workflow` id to `/api/chat`. The backend keeps plain chat backward-compatible while adding workflow-specific output requirements such as tables, actionable steps, Thomas-style reasoning, and evidence boundaries.

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
MAX_REQUESTS_PER_HOUR=12
MAX_REQUESTS_PER_DAY=40
MAX_GLOBAL_REQUESTS_PER_DAY=120
MAX_ESTIMATED_TOKENS_PER_MONTH=800000
```

## DeepSeek Safety Limits

The backend enforces conservative usage limits before calling DeepSeek:

- 12 requests per hour per client
- 40 requests per day per client
- 120 requests per day globally
- 800,000 estimated tokens per month globally

Usage counters are stored in `.data/usage-limits.json`. On Aliyun, `.data/` is symlinked to shared storage so deployments do not reset the counters.

## GitHub Pages

Use `docs/` as the GitHub Pages source. `docs/config.js` points the static frontend to the current HTTPS backend.
