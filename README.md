# Meta Ad Analysis — Frontend

Next.js frontend for the Meta Ad Analysis tool. Submit Facebook page URLs, trigger the Apify actor, and browse the resulting creative intelligence report with per-ad breakdowns and an interactive video interrogation chat.

## Environment variables

Create a `.env.local` file in this directory (copy `.env.example` as a starting point):

```text
APIFY_TOKEN=           # Your Apify API token — found at apify.com/account/integrations
APIFY_ACTOR_ID=        # The deployed actor ID, e.g. your-username/meta-ad-analysis
ANTHROPIC_API_KEY=     # Anthropic API key — powers the Interrogate chat feature
TWELVELABS_API_KEY=    # TwelveLabs API key — powers Interrogate video search
```

`APIFY_ACTOR_ID` accepts either `username/actor-name` or `username~actor-name` format.

All four keys are required for full functionality. `ANTHROPIC_API_KEY` and `TWELVELABS_API_KEY` are only used by the Interrogate feature — the rest of the tool works without them if you only need the analysis report.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Analysis modes

- **Rank only** — scrapes Meta ads and scores them by public signals (run time, impressions, placements). No video download or AI analysis. Fast and cheap.
- **Deep analysis (TwelveLabs)** — runs full TwelveLabs Pegasus video analysis on the top-ranked ads, producing scene breakdowns, hook analysis, pacing, proof mechanisms, and reusable creative patterns.

## Interrogate

Each analyzed ad with a TwelveLabs video ID shows an **Interrogate** button. This opens a chat panel alongside the ad video, backed by Claude Sonnet and TwelveLabs search, letting you ask natural-language questions about specific moments in the ad (e.g. "show me the hook", "where does the product appear?").
