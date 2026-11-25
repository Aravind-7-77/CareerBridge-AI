# CareerBridge AI

A full-stack career guidance prototype for engineering students.

## Stack

- React 19 and Vite
- Express and Node.js
- MongoDB with an in-memory fallback
- JWT authentication
- Helmet security headers and API rate limits
- Recharts

## Run locally

```powershell
copy .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:5000`.

For a production build:

```powershell
npm run build
npm start
```

Then open `http://localhost:5000`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` for deployment |
| `PORT` | Express API port |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret; production requires at least 32 characters |
| `CLIENT_ORIGIN` | Comma-separated allowed frontend origins |
| `TRUST_PROXY_HOPS` | Number of trusted reverse proxies; set only to your hosting topology |
| `LLM_PROVIDER` | Configured LLM provider name |
| `LLM_API_KEY` | Groq API key (keep private) |
| `LLM_MODEL` | Groq model name |
| `LLM_BASE_URL` | Groq OpenAI-compatible API base URL |

Never commit `.env` or API keys.

The mock interviewer uses Groq for opening questions, follow-up responses, and transcript feedback. The server reads `LLM_API_KEY` from `.env`; it never sends the key to the browser. Provider errors are shown in the interview page. Restart the server after changing `.env`.

## Assessment and interview history

All history routes require the user's bearer token:

- `POST /api/assessments/submit` saves the score, correct/total counts, skill analysis and timestamp. `GET /api/assessments/results` returns that user's results, newest first.
- `POST /api/interviews/:id/finish` saves the feedback with the interview. `GET /api/interviews` returns that user's interviews and any saved feedback; `GET /api/interviews/:id/feedback` retrieves feedback for one interview.

## Dashboard data

`GET /api/dashboard` requires the user's bearer token and summarizes their saved profile, assessment results, roadmap, resume analysis, applications, interviews, and recorded activity. Readiness is `null` until an assessment result exists; roadmap progress is `null` until a roadmap is saved. Skill values are based on assessment answers, while profile-only skills are returned without an invented score. Weekly activity contains recorded event counts for the last seven UTC days and is not backfilled for actions from before activity tracking was added. The current resume storage holds one latest analysis, so the dashboard's resume count is zero or one.

## Deployment checklist

- Set `NODE_ENV=production` and configure `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, and `LLM_API_KEY` in the hosting provider's secret/environment settings. Do not copy `.env` into source control. Generate a unique JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and do not share it.
- Production startup requires MongoDB and a JWT secret of at least 32 characters; it will fail instead of silently using in-memory data if MongoDB is unavailable. The health endpoint returns HTTP 503 if the established database connection is lost.
- Set `CLIENT_ORIGIN` to the exact deployed frontend origin (or comma-separated origins). Set `TRUST_PROXY_HOPS` only when behind a proxy, using the exact number of trusted proxy hops; a wrong value can make IP-based rate limits unreliable.
- The app applies Helmet security headers, limits authentication to 10 requests per IP per 15 minutes, and limits AI interview requests to 20 per IP per hour. These limits use in-process memory; configure a shared rate-limit store before deploying multiple server instances.
- Use HTTPS at the hosting provider, restrict MongoDB Atlas network access to the deployment's egress IPs, create a least-privilege database user, and enable database backups.
- Build and validate before starting the production server: `npm run lint`, `npm run build`, then `npm start`. The production server serves the generated `dist` directory.
- If an LLM API key was exposed, revoke it in the provider dashboard and configure the replacement there; changing the local `.env` value alone does not revoke the old key.

## Demo behavior

When `MONGODB_URI` is set and MongoDB connects, the app persists user accounts, profiles, assessments, roadmaps, resume analyses, applications and interview transcripts. In local development, MongoDB can fall back to in-memory storage, which is cleared when the server restarts. Company, job and resource data is seeded in the app. Public career URLs are used for job sources. Interview feedback is explicitly labeled as AI-generated practice feedback, not confidential company information.
