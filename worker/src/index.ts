// Per-person link previews for https://drewhoover.com/how-many-rings/.
//
// The site is static on GitHub Pages, so every shared URL serves the same
// index.html with the same og:image. This Worker is routed over the whole
// /how-many-rings/* subtree (route patterns need a trailing wildcard to match a
// query string) and acts on exactly two things:
//
//   /how-many-rings/?open=<id>  — rewrite the Open Graph / Twitter tags to that person.
//   /how-many-rings/og/<id>.png — render that person's 1200x630 card.
//
// Everything else passes straight through untouched. Data comes from the site's
// own published data/people.json (written at build), so there is nothing to keep in sync by hand.
//
// Deploy: the `worker` job in .github/workflows/deploy.yml runs `wrangler deploy`
// after every push to main (needs the CLOUDFLARE_API_TOKEN repo secret). Locally,
// `npm run dev` passes NO_REPORT=1 so a dev run never reaches Mixpanel.
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import alfaSlab from '../fonts/AlfaSlabOne-Regular.ttf'
import plexMono from '../fonts/IBMPlexMono-SemiBold.ttf'
import teamColorsCss from '../../src/team-colors.css'
import { cardSvg, parseTeamColors, type CardPerson } from './card'

const SITE = 'https://drewhoover.com/how-many-rings/'
const SITE_SLUG = 'how-many-rings'
const OG_PATH = /^\/how-many-rings\/og\/([a-z0-9-]+)\.png$/
const PAGE_PATHS = new Set(['/how-many-rings/', '/how-many-rings/index.html'])
const COLORS = parseTeamColors(teamColorsCss)
const FONTS = [new Uint8Array(alfaSlab), new Uint8Array(plexMono)]

let wasmReady: Promise<void> | undefined
const ensureWasm = () => (wasmReady ??= initWasm(resvgWasm))

/** Set as `--var NO_REPORT:1` in dev (see package.json); never a deployed binding. */
interface ShareEnv { NO_REPORT?: string }

// Analytics: one Mixpanel event per link preview, sent server-side to the
// index site's project (the public token its embed carries; a project token
// only writes). The client embed never sees an unfurl, because the bot that
// fetches a shared link runs no script, so this is the only place a share
// can be counted. Nothing personal goes: the crawler's name, its user agent
// only when it is a crawler, the country Cloudflare saw, the URL itself and
// the person it opens. A browser's visit is the embed's to count, so the head
// rewrite reports crawlers only; the card is reported whoever asked for it.
const MIXPANEL_TOKEN = '1c6a0f45b8a5768185a8d9a2f4d65452'
const AGENTS: [RegExp, string][] = [
  [/Slackbot|Slack-ImgProxy/i, 'slack'],
  [/Discordbot/i, 'discord'],
  [/TelegramBot/i, 'telegram'],
  [/WhatsApp/i, 'whatsapp'],
  [/LinkedInBot/i, 'linkedin'],
  [/redditbot/i, 'reddit'],
  [/Bluesky/i, 'bluesky'],
  [/Mastodon/i, 'mastodon'],
  [/Facebot.*Twitterbot|Twitterbot.*Facebot/i, 'imessage'],
  [/Twitterbot/i, 'twitter'],
  [/facebookexternalhit|Facebot/i, 'facebook'],
  [/Googlebot/i, 'google'],
  [/bingbot/i, 'bing'],
  [/Applebot/i, 'apple'],
  [/bot|crawler|spider|preview|fetch|embed|scraper/i, 'other-bot'],
]
const agentOf = (ua: string | null): string => AGENTS.find(([re]) => re.test(ua ?? ''))?.[1] ?? 'browser'

function report(env: ShareEnv, ctx: ExecutionContext, request: Request, event: string, props: Record<string, unknown>) {
  if (env.NO_REPORT) return
  try {
    const ua = request.headers.get('user-agent')
    const agent = agentOf(ua)
    const body = [{
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: `unfurl:${agent}`,
        $insert_id: crypto.randomUUID(),
        time: Math.floor(Date.now() / 1000),
        site: SITE_SLUG,
        agent,
        crawler: agent === 'browser' ? null : (ua ?? '').slice(0, 200),
        country: (request as Request & { cf?: { country?: string } }).cf?.country ?? null,
        ...props,
      },
    }]
    // ip=0: Mixpanel must not geolocate the request
    ctx.waitUntil(fetch('https://api.mixpanel.com/track?ip=0', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/plain' },
      body: JSON.stringify(body),
    }).then((r) => r.body?.cancel()).catch(() => {}))
  } catch { /* reporting must never break a preview */ }
}

/** The URL itself and the person it opens, for an event. */
const urlProps = (url: URL, open: string) => ({
  url: url.href,
  $current_url: url.href,
  path: url.pathname.replace(`/${SITE_SLUG}`, '') || '/',
  scope: url.searchParams.get('scope'),
  open,
})

interface Person extends CardPerson {
  id: string
  photo?: string
}
interface People { built: string; byId: Map<string, Person> }

/** Shape of data/people.json, written by scripts/prerender.mjs. */
interface PeopleFile {
  built: string
  people: Record<string, Omit<Person, 'id'>>
}

// Immutable, read-only cache of the published people index, shared across
// requests in this isolate and refreshed every few minutes. No request state lives here.
let peopleCache: { at: number; value: Promise<People> } | undefined
const PEOPLE_TTL_MS = 5 * 60_000

function loadPeople(): Promise<People> {
  if (peopleCache && Date.now() - peopleCache.at < PEOPLE_TTL_MS) return peopleCache.value
  const value = (async () => {
    const res = await fetch(`${SITE}data/people.json`, { cf: { cacheTtl: 300, cacheEverything: true } })
    if (!res.ok) throw new Error(`people.json HTTP ${res.status}`)
    const data = (await res.json()) as PeopleFile
    const byId = new Map<string, Person>()
    for (const [id, p] of Object.entries(data.people)) byId.set(id, { id, ...p })
    return { built: data.built, byId }
  })()
  peopleCache = { at: Date.now(), value }
  value.catch(() => { if (peopleCache?.value === value) peopleCache = undefined })
  return value
}

function log(level: 'info' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({ level, msg, ...extra }))
}

/** "Alabama 2009, 2011, 2012 · Georgia 2021" */
function seasonsText(p: Person) {
  const bySchool = new Map<string, number[]>()
  for (const [season, team] of p.rings) bySchool.set(team, [...(bySchool.get(team) ?? []), season])
  return [...bySchool].map(([team, s]) => `${team} ${s.join(', ')}`).join(' · ')
}

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

async function rewriteMeta(request: Request, id: string): Promise<Response> {
  const origin = await fetch(request)
  if (!origin.ok || !(origin.headers.get('content-type') ?? '').includes('text/html')) return origin

  const people = await loadPeople()
  const p = people.byId.get(id)
  if (!p) return origin

  const url = new URL(request.url)
  const title = `${p.name} has ${p.total} national championship ${p.total === 1 ? 'ring' : 'rings'}`
  const desc = `${p.role}. ${seasonsText(p)}.${p.playerTitles ? ` Plus ${p.playerTitles} as a player.` : ''} Every ring cited to a source.`
  const image = `${SITE}og/${p.id}.png?v=${encodeURIComponent(people.built)}`
  const shareUrl = `${SITE}${url.search}`

  const set = (value: string) => ({ element(el: Element) { el.setAttribute('content', value) } })
  // The page carries its own og:image:alt; set it, and only add one if a
  // stale build somehow shipped without it.
  let altSeen = false
  const res = new HTMLRewriter()
    .on('meta[property="og:title"]', set(title))
    .on('meta[name="twitter:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[name="twitter:description"]', set(desc))
    .on('meta[property="og:image"]', set(image))
    .on('meta[name="twitter:image"]', set(image))
    .on('meta[property="og:url"]', set(shareUrl))
    .on('meta[property="og:image:alt"]', { element(el) { altSeen = true; el.setAttribute('content', title) } })
    .on('head', {
      element(el) {
        el.onEndTag((end) => { if (!altSeen) end.before(`<meta property="og:image:alt" content="${attr(title)}" />`, { html: true }) })
      },
    })
    .transform(origin)

  // The page varies by query now; keep shared caches from serving one person's
  // tags for another's URL.
  const out = new Response(res.body, res)
  out.headers.set('cache-control', 'public, max-age=600')
  return out
}

async function photoDataUri(photo: string | undefined): Promise<string | undefined> {
  if (!photo || !photo.endsWith('.jpg')) return undefined
  const res = await fetch(`${SITE}headshots/${photo}`, { cf: { cacheTtl: 86400, cacheEverything: true } })
  if (!res.ok) return undefined
  const bytes = new Uint8Array(await res.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:image/jpeg;base64,${btoa(bin)}`
}

async function renderCard(request: Request, env: ShareEnv, id: string, ctx: ExecutionContext): Promise<Response> {
  // A private key, not the request URL: the zone cache shares this keyspace, and
  // it once held GitHub's 404 for these URLs from before the route existed.
  const url = new URL(request.url)
  const key = new Request(`${SITE}__og-card-cache/${id}.png${url.search}`)
  const cache = caches.default
  const hit = await cache.match(key)
  const cached = !!hit && hit.headers.get('content-type') === 'image/png'
  report(env, ctx, request, 'share card', { ...urlProps(url, id), cached })
  if (cached) return hit

  const people = await loadPeople()
  const p = people.byId.get(id)
  if (!p) return new Response('Not found', { status: 404 })

  const [, photo] = await Promise.all([ensureWasm(), photoDataUri(p.photo)])
  const svg = cardSvg(p, COLORS, photo)
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontBuffers: FONTS, loadSystemFonts: false, defaultFontFamily: 'IBM Plex Mono' },
  }).render().asPng()

  const res = new Response(png, {
    headers: {
      'content-type': 'image/png',
      // Versioned by data build (?v=), so a long life is safe.
      'cache-control': 'public, max-age=86400, s-maxage=604800',
    },
  })
  ctx.waitUntil(cache.put(key, res.clone()))
  return res
}

/** If anything breaks, the generic site card is still a fine preview. */
const fallbackCard = () => fetch(`${SITE}og.png`)

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)

    const og = url.pathname.match(OG_PATH)
    if (og) {
      try {
        return await renderCard(request, env, og[1], ctx)
      } catch (e) {
        log('error', 'card render failed', { id: og[1], error: String(e) })
        return fallbackCard()
      }
    }

    const open = url.searchParams.get('open')
    if (request.method === 'GET' && PAGE_PATHS.has(url.pathname) && open && /^[a-z0-9-]+$/.test(open)) {
      try {
        // a crawler fetching a shared link is the only trace a share leaves; a browser's visit is the embed's to count
        if (agentOf(request.headers.get('user-agent')) !== 'browser') report(env, ctx, request, 'share unfurl', urlProps(url, open))
        return await rewriteMeta(request, open)
      } catch (e) {
        log('error', 'meta rewrite failed', { open, error: String(e) })
        return fetch(request)
      }
    }

    return fetch(request)
  },
} satisfies ExportedHandler<ShareEnv>
