// Post-build: put real content in dist/index.html.
//
// A Vite SPA ships `<div id="root"></div>` and nothing else — every name, rank
// and number exists only after React runs. Google may render JS on a deferred
// pass; Bing, DuckDuckGo, social unfurlers and the LLM crawlers largely will not.
//
// This renders the app with a trimmed top-100 seed, injects both the markup and
// the seed, and emits JSON-LD from the same rows so the structured data cannot
// drift from what is on screen. The client hydrates against the identical seed,
// then swaps in the full dataset.
//
// Usage: node scripts/prerender.mjs   (runs after `vite build`)
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const SITE = 'https://drewhoover.com/how-many-rings/'
const TOP = 100

const full = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'rings.json'), 'utf8'))

// Everything the collapsed list paints, and nothing else: no citations, no
// coverage notes, no ring beyond the first hundred people. 741KB -> ~60KB.
const seed = {
  meta: {
    built: full.meta.built,
    seasonCount: full.meta.seasonCount,
    peopleTotal: full.meta.peopleTotal,
    note: full.meta.note,
    employmentRules: full.meta.employmentRules,
    excludedCount: full.meta.excludedCount,
    excludedTop: [],
    seasons: [],
  },
  coaches: full.coaches.slice(0, TOP).map((c) => ({
    id: c.id, name: c.name, primaryRole: c.primaryRole, primaryCat: c.primaryCat,
    total: c.total, support: c.support, onfield: c.onfield, head: c.head,
    schools: c.schools, photo: c.photo, placeholder: c.placeholder,
    player: c.player ? { titles: c.player.titles, detail: '', sources: [] } : undefined,
    rings: c.rings.map((r) => ({ season: r.season, team: r.team, cat: r.cat, role: r.role, sources: [] })),
  })),
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const { App } = await vite.ssrLoadModule('/src/App.tsx')
const markup = renderToString(React.createElement(App, { initialData: seed }))
await vite.close()

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': SITE,
      url: SITE,
      name: 'Who Has the Most College Football Championship Rings?',
      description: 'Every person on a national-championship staff since 1990, ranked by rings.',
      isPartOf: { '@type': 'WebSite', url: 'https://drewhoover.com/', name: 'drewhoover.com' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'drewhoover.com', item: 'https://drewhoover.com/' },
        { '@type': 'ListItem', position: 2, name: 'Who Has the Most College Football Championship Rings?', item: SITE },
      ],
    },
    {
      '@type': 'ItemList',
      name: 'College football staff ranked by national championship rings',
      numberOfItems: full.coaches.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      // Only the rows the page actually renders — structured data that overstates
      // the page is a penalty, not a boost.
      itemListElement: seed.coaches.slice(0, 25).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Person',
          name: c.name,
          jobTitle: c.primaryRole,
          affiliation: c.schools.map((s) => ({ '@type': 'CollegeOrUniversity', name: s })),
          description: `${c.total} national championship rings (${c.schools.join(', ')})`,
        },
      })),
    },
  ],
}

const out = path.join(root, 'dist', 'index.html')
let page = fs.readFileSync(out, 'utf8')
// Throw rather than silently no-op: a Vite change that renames this marker would
// otherwise quietly put us back to shipping an empty page.
if (!page.includes('<div id="root"></div>')) throw new Error('prerender: no empty #root found in dist/index.html')

page = page.replace('<div id="root"></div>',
  `<div id="root">${markup}</div>\n<script id="seed-data" type="application/json">${
    JSON.stringify(seed).replace(/</g, '\\u003c')}</script>`)
page = page.replace('</head>',
  `  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>\n  </head>`)
fs.writeFileSync(out, page)

// Search Console wants a sitemap to submit, and this is where lastmod lives.
fs.writeFileSync(path.join(root, 'dist', 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${full.meta.built}</lastmod></url>
</urlset>
`)

const kb = (n) => Math.round(n / 1024) + 'KB'
console.log(`prerendered ${kb(markup.length)} of markup + ${kb(JSON.stringify(seed).length)} seed (${seed.coaches.length} people)`)
console.log(`dist/index.html now ${kb(fs.statSync(out).size)}; sitemap.xml written`)
