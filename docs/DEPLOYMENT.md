# Vercel deployment specification

## Required platform settings

- Framework preset: **Next.js**
- Root directory: repository root
- Node.js: **22.x** (minimum supported 20.19)
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave empty / Next.js default
- Function region: `bom1` (configured in `vercel.json`)
- Agent and optimizer max duration: 60 seconds

## Required production services

Use an external, pooled, Vercel-compatible PostgreSQL provider such as Neon or Supabase. Production does not use SQLite or local files. Run `npm run db:migrate` against the target database before promoting the deployment.

Production variables: `DATABASE_URL`, `APP_URL`, `DEMO_MODE`, `AUTONOMY_LEVEL`, `MAX_AUTONOMOUS_REFUND_INR`, `MAX_BATCH_BUDGET_INR`, `AGENT_MAX_STEPS`, and `AGENT_MAX_RETRIES`. `GEMINI_API_KEY` and `GEMINI_MODEL` are optional; without them `/intake` exposes structured manual entry. Gemini is used only for language extraction and never receives write tools. Never prefix secrets with `NEXT_PUBLIC_`.

## Git integration

Import the GitHub repository into Vercel. Feature branches and pull requests create Preview deployments; `main` creates Production deployments. Require the repository CI workflow before merging.

## Manual CLI path

```bash
npm i -g vercel@latest
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_MODEL production
vercel deploy
vercel deploy --prod
```

For custom CI, store `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub secrets, then use `vercel pull`, `vercel build --prod`, and `vercel deploy --prebuilt --prod`. Never commit `.vercel/project.json` or tokens.

## Readiness and rollback

Check `/api/health`, execute the delayed-order demo, verify the exported Decision Record, and scan function logs. Prefer promoting a validated preview artifact. Roll back with `vercel rollback` or promote the prior deployment; database migrations must be backward compatible.
