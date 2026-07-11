# Med-log backend setup

One-time setup to wire up NFC tag scans → Cloudflare Worker →
`repository_dispatch` → `web/docs/status.json` → GitHub Pages, which the
panel polls every 5 minutes.

## 1. GitHub PAT for the Worker

Create a **fine-grained personal access token** (github.com → Settings →
Developer settings → Fine-grained tokens):
- Repository access: only `DowneyControlPanel`
- Permissions: **Contents: Read and write**, **Actions: Read and write**
  (needed for the `dispatches` endpoint)

Keep this token somewhere safe — you'll paste it into a Worker secret in
step 3, never into a file in this repo.

## 2. Pick a shared secret

Choose a long random string (e.g. `openssl rand -hex 16`). This is the
`code` value embedded in all 7 tag URLs.

## 3. Deploy the Cloudflare Worker

```
cd web/med-log-worker
npm install
npx wrangler login
npx wrangler secret put GITHUB_PAT       # paste the PAT from step 1
npx wrangler secret put SHARED_SECRET    # paste the secret from step 2
npx wrangler deploy
```

Note the deployed URL, e.g. `https://downey-med-log.<your-subdomain>.workers.dev`.

## 4. Enable GitHub Pages (Actions-based)

Repo → Settings → Pages → **Build and deployment → Source: GitHub
Actions**. No branch/folder selection needed — `log-med.yml` publishes
`web/docs/` itself via `actions/deploy-pages`. After the first successful
workflow run, the Pages URL will be shown there
(`https://ejdprops.github.io/DowneyControlPanel/`).

## 5. Per-tag URL format

Each tag's Shortcut hits:

```
https://<worker-subdomain>.workers.dev/log?person=<evan|karen>&period=<period>&day=<1-31>&code=<shared secret>
```

Valid `period` values: `am`, `midday`, `bedtime` for Evan; `am`, `midday`,
`dinner`, `bedtime` for Karen.

## 6. iOS Shortcuts + NFC automations (×7)

For each of the 7 tags:

1. Shortcuts app → **Automation** → **+** → **NFC** → scan the tag →
   **Create new Shortcut**. Turn off "Ask Before Running" so it fires
   silently on tap.
2. Add actions:
   - **Format Date** → Current Date, Custom Format `d` (gives day-of-month
     with no leading zero, matching the Worker's `Number(day)` comparison).
   - **Text** → build the URL, e.g.:
     `https://<worker-subdomain>.workers.dev/log?person=evan&period=am&day=[Formatted Date]&code=<shared secret>`
   - **Get Contents of URL** → the Text above, Method GET.
3. Repeat for all 7 person/period combinations (Evan: am, midday, bedtime;
   Karen: am, midday, dinner, bedtime), each pointed at its own physical
   tag.

## 7. Verify

```
curl -i "https://<worker-subdomain>.workers.dev/log?person=evan&period=am&day=$(date +%-d)&code=<shared secret>"
```

Should return `200 logged`. Check the Actions tab for the `Log medication
taken` run, and fetch the Pages URL's `status.json` to confirm it updated.
Then try a wrong `code` (expect `403`) and a wrong `day` (expect `409`) to
confirm rejection.

## Rotating the shared secret

If it ever leaks: pick a new value, `wrangler secret put SHARED_SECRET`
again, and update all 7 Shortcuts with the new `code`.

## Troubleshooting: unexpected 403s

The shared `*.workers.dev` domain has Cloudflare's own bot protection in
front of it. A request with no/unusual `User-Agent` (e.g. bare `curl`,
Python's default `urllib` UA) can get blocked with Cloudflare error 1010
*before it ever reaches the Worker code* — this looks identical to a
wrong `code` from the outside. iOS Shortcuts' "Get Contents of URL" sends
normal-looking headers and was verified to work; when testing manually
with `curl`, add `-A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS
X) AppleWebKit/605.1.15"` to rule this out before suspecting the secret or
the Worker logic.
