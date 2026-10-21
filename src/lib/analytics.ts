// The analytics embed (drewhoover.com/embed/analytics.js) is third-party and
// blockable, hence optional-chained: a blocked script must never break a click.

declare global {
  interface Window { dhAnalytics?: { track: (name: string, props?: Record<string, unknown>) => void } }
}

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom'

export const track = (name: string, props?: Record<string, unknown>) => {
  try { window.dhAnalytics?.track(name, props) } catch { /* the embed is optional */ }
}
