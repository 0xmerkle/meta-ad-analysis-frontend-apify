# Meta Ad Analysis Frontend

Next.js TypeScript UI for running the `meta-ad-competitor-analysis` Apify Actor and viewing/exporting the report.

## Setup

Create `.env.local` from `.env.example` and set:

```text
APIFY_TOKEN=your-apify-token
APIFY_ACTOR_ID=numerous_hierarchy/meta-ad-competitor-analysis
```

`APIFY_ACTOR_ID` can use either `username/actor-name` or the Apify API path form `username~actor-name`.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- The token is only read by the server route in `app/api/analyze/route.ts`.
- `rank-only` is the default UI mode because it is cheaper and faster for testing.
- `full` mode runs the full actor workflow, including transcription and vision analysis.
