# goyangi v1 — frontend

Nuxt 4 + Vue 3 + PrimeVue + Pinia + Tailwind 4. Talks to a PocketBase backend ([../goyangi-v1-be](../goyangi-v1-be)).

## Requirements

- Node 26+ (see [.nvmrc](.nvmrc))
- pnpm 11+ (managed via Corepack — `corepack enable`)
- PocketBase backend running (locally on `:8090`, or a remote instance)

## Setup

```bash
pnpm install
cp .env.example .env   # edit values as needed
pnpm dev
```

App runs on http://localhost:3000.

## Environment variables

See [.env.example](.env.example). Both vars are public (`NUXT_PUBLIC_*`) and shipped to the browser.

| Var                    | Purpose            | Dev default                     |
| ---------------------- | ------------------ | ------------------------------- |
| `NUXT_PUBLIC_BASE_URL` | PocketBase API URL | `http://127.0.0.1:8090/`        |
| `NUXT_PUBLIC_HOST_URL` | CDN/media host URL | `https://dev-cdn.goyangi.pics/` |

## Scripts

| Script                   | What it does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `pnpm dev`               | Dev server with HMR                                                               |
| `pnpm build`             | Production build to `.output/`                                                    |
| `pnpm start`             | Run the built server                                                              |
| `pnpm preview`           | Preview the production build                                                      |
| `pnpm generate`          | Static-site generation                                                            |
| `pnpm lint` / `lint:fix` | ESLint                                                                            |
| `pnpm typecheck`         | Type-check the project                                                            |
| `pnpm typegen`           | Regenerate `app/types/pocketbase-types.ts` from `../goyangi-v1-be/pb_schema.json` |

## Embed variants

A content, set or collection page renders social/OG tags for whatever Discord
scrapes. Query params pick which rendition the embed carries:

| URL                | Embeds                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| `/single/<id>`     | the animated preview (AVIF/WebP), or the mp4 for `video` records                       |
| `/single/<id>?mp4` | the AV1 1080p mp4                                                                      |
| `/single/<id>?sd`  | the H.264 720p mp4 — for Safari below A17 Pro / M3, which renders AV1 as a blank frame |

`?sd` falls back to the AV1 original when the record has no `sd` object: it is
best-effort in the encode pipeline and absent on records that predate the
rendition, and an empty og:video embeds nothing at all.

The embed heading is the item's own `title`, falling back to "idols · groups"
only when there is none.

## Short links

Every "copy link" control hands out `/v/<contentId><suffix>` rather than the
CDN URL. The CDN keys are namespaced by group/idol/date, which makes them ~85
characters and wraps them in a Discord message; the short link 302s to the same
object ([server/routes/v/[id].get.ts](server/routes/v/%5Bid%5D.get.ts)), and
Discord follows the redirect and embeds the mp4 or image as it would the CDN URL.

The suffix is the real file's extension, and it matters: Discord classifies a
media link by the extension in the URL before fetching it. A bare `/v/<id>`
rendered an animated WebP as a single frame; `/v/<id>.webp` animates.

| URL                      | Redirects to                                               |
| ------------------------ | ---------------------------------------------------------- |
| `/v/<id>.webp` / `.avif` | the preview (animated for gifs, the grid still for images) |
| `/v/<id>.mp4`            | the AV1 1080p mp4                                          |
| `/v/<id>-sd.mp4`         | the H.264 720p mp4, falling back to the AV1 original       |
| `/v/<id>-hd.avif`        | an image's full-size original                              |

`/v/<id>` with `?hd` / `?sd` / nothing still resolves, for links already pasted.

Playback and downloads keep using the CDN URL directly — nobody reads those.
A record that is still encoding 404s (uncached) until its renditions land.

## Deployment

Production builds output to `.output/`. Set `NUXT_PUBLIC_BASE_URL` and `NUXT_PUBLIC_HOST_URL` to your prod values at build/start time, then run `pnpm start` (or your host's preferred entrypoint).
