# Dashboard

A personal news dashboard. A scheduled GitHub Action fetches RSS and Atom feeds every 30 minutes, sorts articles into **Work** and **Hobby** topics by keyword, and publishes a static page to GitHub Pages. There is no server, database or login.

## Change your interests

Edit [`config/interests.yaml`](config/interests.yaml) on github.com and commit. The site rebuilds on every push to `main`, so changes show up within a few minutes. Articles that match no topic are dropped, and articles older than 30 days age out.

Read and saved marks are stored in your browser's localStorage. They stay private but don't sync between devices.

## One-time setup

1. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Open **Actions → Fetch and deploy → Run workflow** to publish the first time.
3. The site is at `https://<your-user>.github.io/dashboard/`.

GitHub turns off scheduled workflows in public repos after 60 days without any commits. Editing the config now and then keeps it running; if it stops, re-enable it from the Actions tab.

## Develop locally

```bash
npm ci
```

```bash
npm run sample   # copies sample data to public/articles.json
```

```bash
npm run dev
```

`npm run fetch` fetches the real feeds into `public/articles.json`. `npm test`, `npm run typecheck` and `npm run build` are what CI runs.

## Security notes

The feeds are untrusted input. The things that keep that safe:

- Feed data is only handled inside the Node fetcher (`fetcher/`). It never reaches a `${{ }}` expression or a shell line in the workflow.
- The XML parser never expands DOCTYPE entities, and it rejects external ones (no XXE or entity bombs). Each feed has a 10 s timeout and a 5 MB cap.
- Titles and summaries are stripped to plain text, and React renders them as text. Links must be `http`/`https`; anything else, such as `javascript:`, is dropped. The built page ships a strict Content-Security-Policy.
- Workflows run with minimal `permissions`, pin third-party actions to commit SHAs, and never use `pull_request_target`. Dependabot keeps actions and npm packages current.

Everything in `config/interests.yaml` and on the site is public.
