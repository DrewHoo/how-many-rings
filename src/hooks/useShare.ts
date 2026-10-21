import { useState } from 'react'
import { track } from '../lib/analytics.ts'

/**
 * The native share sheet where there is one, else copy "text url" and flash
 * "copied". The text is the page's one sentence (or the open person's line),
 * so a pasted share carries a quotable line and not just an address.
 */
export function useShare() {
  const [copied, setCopied] = useState(false)
  const share = (text: string, url: string, props?: Record<string, unknown>) => {
    try {
      track('share', { text, url, ...props })
      if (navigator.share) { navigator.share({ title: 'How Many Rings?', text, url }).catch(() => {}); return }
      navigator.clipboard.writeText(`${text} ${url}`).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
    } catch { /* no clipboard, no share sheet: nothing to do */ }
  }
  return { copied, share }
}
