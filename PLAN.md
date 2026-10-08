# Migration Plan — React + Vite + TypeScript on Firebase

## 1. Context

The app has outgrown its vanilla structure. Measured at the time of writing:

| File | Lines | Bytes | Longest line |
|---|---|---|---|
| `app.js` | 733 | 40 KB | **1,386** |
| `style.css` | 158 | 22 KB | **2,424** |
| `chat.js` | 439 | 17 KB | 186 |
| `prompts/chatPrompt.js` | 217 | 15 KB | 552 |
| *total* | ~2,000 | ~117 KB | |

The diagnosis matters more than the totals: **the cost driver is line length, not
file length.** `style.css` is only 158 lines but effectively minified, and
`app.js` builds its profile panel from a single 1,386-character template string.
Changing one label in either means reproducing a huge exact string, so trivial
edits cost disproportionate tokens and are error-prone — every CSS change in
recent sessions required a scripted replacement rather than a normal edit.

This migration targets that directly: JSX turns template strings into
line-addressable markup, and utility classes remove the stylesheet entirely.

Alongside it, the app moves off GitHub Pages onto Firebase, gains real
authentication, and gets CI/CD that runs on every push.

### Decisions already confirmed

- **Firebase AI Logic** for Gemini — no API key in the browser.
- **No Firestore yet.** Persistence stays in `localStorage`; the data layer is a
  separate later step.
- **TypeScript** — more characters to write, far fewer to debug.
- **Tailwind** — the largest single token win available, given the numbers above.

## 2. Stack

| Concern | Choice | Why this one |
|---|---|---|
| Build | Vite | Fast, first-class TS, trivial Firebase Hosting output |
| UI | React 19 + TypeScript | — |
| Routing | React Router | The chat is already a separate tab → `/chat/:sessionId` |
| Styling | Tailwind v4 (Vite plugin, no config file) | Kills the 2,424-char line problem |
| State | Zustand | Minimal boilerplate; a store is ~20 lines |
| Validation | Zod | One schema gives runtime parsing *and* the static type via `z.infer` |
| AI | Firebase AI Logic (`firebase/ai`, Gemini Developer API backend) | No client key; free Spark tier |
| Auth | Firebase Authentication (Google provider) | Identifies users; gates AI cost |
| Hosting | Firebase Hosting | Replaces GitHub Pages |
| Unit tests | Vitest | Pure logic verified in milliseconds instead of minutes |
| E2E | Playwright (existing suites, ported) | Keep only for real user flows |
| Lint/format | ESLint + Prettier, `printWidth: 100` | Mechanically prevents long lines returning |

**Deliberately not adding:** a charting library (the hand-rolled scatter SVG is
~100 lines and already efficient — port it as a component), a component library
(the design is bespoke), TanStack Query (nothing remote is fetched yet).

## 3. Token-efficiency conventions

Requirement #1, enforced by tooling rather than willpower:

- **`printWidth: 100` in Prettier.** The highest-impact single rule — it makes
  1,386- and 2,424-character lines structurally impossible.
- **Soft budget: ~150 lines per component, ~200 per module.** `app.js` at 733
  lines becomes roughly a dozen focused files.
- **Pure logic isolated in `src/domain/`** — phase resolution, session pressure,
  opening disposition, timer math, trait sampling, CSV encode/decode. No DOM, no
  React. This is where verification gets cheap: the current Playwright suites
  take ~6 minutes; equivalent unit tests run in under a second.
- **Playwright reserved for genuine E2E** (generate → stories → chat → timer).
- **`CLAUDE.md` at the repo root** recording conventions, the directory map and
  prompt-editing rules, so each session doesn't re-derive them.
- **Path alias `@/`** so imports stay short and unambiguous.
- **Prompts remain isolated modules** under `src/prompts/` — the existing pattern
  works and survives the port unchanged in spirit.

## 4. Target structure

```
src/
  main.tsx, App.tsx
  routes/        LoginPage.tsx, GeneratorPage.tsx, ChatPage.tsx
  features/
    auth/        AuthProvider, ProtectedRoute, sign-in UI
    population/  generation controls, scatter plot, CSV import/export
    characters/  profile panel, story list
    chat/        transcript, composer, timer, guardrail notice, anamnese
    settings/    settings menu + panels
  domain/        pure logic (phases, pressure, disposition, timer, traits)
  prompts/       story / chat / guardrail prompts + response schemas
  lib/           firebase.ts, ai.ts, storage.ts
  data/          the trait JSON files, unchanged
```

`lib/ai.ts` replaces `gemini.js` and keeps its most valuable behaviour: the
overload fallback to a secondary model on 429/503. The Firebase AI Logic call
shape (`getAI` → `getGenerativeModel` → `generateContent`) should be confirmed
against current docs at implementation time rather than assumed.

## 5. Authentication

### Why it is now required, not optional

This is the most important consequence of adopting Firebase AI Logic, and it
changes the app's economics. Today each user supplies their own Gemini key and
pays for their own usage. After the migration **every Gemini call is billed to
the project owner**. Without authentication, a public Hosting URL is an open,
owner-funded Gemini proxy.

So Auth is not a feature here — it is cost control.

### Configuration

- **Provider: Google Sign-In only.** No passwords, no reset flows, and the owner
  already has a Google identity through Firebase. Email/password can be added
  later if other people need accounts without Google.
- **Do not enable Anonymous auth.** It would let any visitor spend the owner's
  quota, defeating the purpose.
- `AuthProvider` exposes the user via context; a `ProtectedRoute` wrapper
  redirects unauthenticated visitors to `/login`.
- Both routes (`/` and `/chat/:sessionId`) sit behind the guard. The chat opens
  in a new tab and shares the same Firebase auth session, so no extra handoff is
  needed.
- Sign-out lives in the existing settings menu, which loses its API key panel and
  gains an account panel.

### Open decision — restricting *who* may sign in

Firebase Auth with the Google provider lets **any** Google account sign in. To
keep this private, there are three honest options:

| Approach | Enforcement | Cost |
|---|---|---|
| Client-side email allowlist | **Cosmetic only** — bypassable, since the check runs in the browser | Free |
| Auth blocking function (`beforeSignIn`) | Real, server-side | Requires Blaze plan |
| Firestore allowlist + security rules | Real, but only protects Firestore — *not* AI Logic calls | Needs Firestore (out of scope) |

**Recommendation:** start open-but-authenticated and rely on two safety nets —
App Check (only this app's origin can call Gemini) and the **Spark plan's hard
quota**, which means the worst case is hitting a limit rather than receiving a
bill. Revisit blocking functions only if the URL is shared widely.

This is the one genuinely unresolved decision in this plan and should be settled
before step 6 of the migration.

## 6. Firebase Hosting

Replaces GitHub Pages, which currently serves the repo's `main` branch directly.

**`firebase.json` essentials:**

- `"public": "dist"` — Vite's build output.
- **SPA rewrite:** `"rewrites": [{ "source": "**", "destination": "/index.html" }]`.
  Without this, a hard refresh on `/chat/abc` returns 404 — the single most
  common React Router + static hosting mistake.
- **Cache headers:** Vite emits content-hashed asset filenames, so
  `/assets/**` can be `max-age=31536000, immutable`, while `index.html` must be
  `no-cache` or users get a stale shell pointing at deleted bundles. This also
  retires the manual `?v=` cache-busting currently maintained by hand in
  `index.html` and `chat.html`.
- `"cleanUrls": true`, and `"ignore"` the usual `firebase.json`, `**/.*`,
  `**/node_modules/**`.

**Cutover:** keep GitHub Pages live until the Firebase URL is verified working,
then disable Pages in repo settings. A custom domain can be attached later;
Firebase provisions the TLS certificate automatically.

## 7. CI/CD on GitHub pushes

Three workflows under `.github/workflows/`. Running `firebase init hosting:github`
generates the two deploy workflows and stores the `FIREBASE_SERVICE_ACCOUNT`
secret automatically — do that rather than hand-writing service account JSON.

**`ci.yml` — on every push and pull request:**

1. `actions/setup-node` with the Node version pinned and npm cache enabled
2. `npm ci`
3. `npm run typecheck` (`tsc --noEmit`)
4. `npm run lint`
5. `npm run test` (Vitest)
6. `npm run build`
7. `npx playwright test` (E2E, with the browser binary cached)

**`firebase-hosting-pull-request.yml`** — deploys each PR to a **preview channel**
and comments the temporary URL on the PR. This is what makes review of a visual
rewrite practical.

**`firebase-hosting-merge.yml`** — deploys to the live channel on merge to `main`.

**Supporting setup:**

- Branch protection on `main`: require `ci.yml` to pass before merge.
- Firebase config (project ID, app ID, API key) goes in `.env` files exposed via
  Vite's `VITE_` prefix. These are **not secrets** — Firebase web config is
  public by design; App Check and Auth are what provide security. The service
  account used by CI *is* a secret and lives only in GitHub Secrets.
- Concurrency group per branch so superseded runs cancel instead of queuing.

## 8. App Check — time-sensitive

**App Check enforcement becomes mandatory for Firebase AI Logic on 2 November
2026.** That is weeks away, so it belongs in the migration itself, not in a later
hardening pass.

- Register a **reCAPTCHA Enterprise** site key for the web app.
- Local development needs an **App Check debug token**; without it every AI call
  fails on `localhost`, which is a confusing failure mode to hit cold.
- CI/E2E runs need the same debug token, or AI calls must be mocked — the
  existing Playwright suites already intercept the Gemini endpoint, so **keep
  mocking in CI** rather than spending real quota on every push.
- The Gemini Developer API backend runs on the **free Spark plan**; no billing
  account required at this scale.

## 9. Migration sequence

Ordered so the app is never broken for long, and the riskiest infrastructure is
proven before any rewriting begins.

1. **Prove the pipeline first.** Create the Firebase project, enable Hosting, and
   deploy the *existing static app unchanged*. Wire the GitHub Actions workflows.
   Nothing is rewritten until deployment demonstrably works end to end.
2. **Scaffold** Vite + TS + Tailwind + Vitest + ESLint/Prettier alongside the
   current files.
3. **Port `src/domain/` and `src/prompts/`** — mechanical, no UI risk, and the
   right place to build Vitest coverage first.
4. **Add Auth** — login route, provider, guards. Do this before the AI switch so
   there is never a window where an unauthenticated page can spend quota.
5. **Port the chat page** — smaller, self-contained, most recently understood.
6. **Port the generator page** — the bigger lift: scatter SVG, trait sliders, CSV
   round-trip, profile panel.
7. **Switch to Firebase AI Logic + App Check**; delete the API key panel and
   `gemini.js`.
8. **Cut over** and retire GitHub Pages.

## 10. Verification

1. `tsc --noEmit`, ESLint and Prettier run clean in CI on every PR.
2. Vitest covers `src/domain/` and `src/prompts/`. The pressure bands, phase
   thresholds, opening disposition, timer arithmetic and settings clamping all
   have hand-written checks from recent sessions that port directly into real
   assertions.
3. The existing Playwright suites — `verify_pressure`, `verify_guardrail`,
   `verify_config_timer`, `verify_grace`, `verify_endmodal`, `verify_endsession`,
   `verify_opening`, `verify_phases`, `verify_region`, `verify_emptystate` —
   move to `tests/e2e/` and must pass against the React build. **They are the
   acceptance criteria for each ported page**, and the regression net for the
   whole rewrite.
4. Auth: signing out redirects to `/login`; a protected route hit while signed
   out redirects rather than rendering; a hard refresh on `/chat/:id` loads the
   page (proves the SPA rewrite) and keeps the session.
5. A PR produces a Firebase preview URL; merging deploys to production.
6. Manual parity pass against the current app: generate a population, export and
   re-import CSV, generate stories, then run a short session end to end including
   a guardrail block, the final-stretch behaviour and the grace message.

## 11. Out of scope

- **Firestore and the data layer.** The natural follow-up: persist populations
  and stories (expensive to generate) while leaving chat transcripts local. Needs
  its own data modelling and security-rules work.
- **Restricting sign-in to specific accounts** beyond the safety nets described
  in §5 — needs the Blaze plan.
- **Multi-user features** (sharing populations, reviewing past sessions).
