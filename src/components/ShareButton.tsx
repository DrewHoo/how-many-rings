import { useState } from 'react'

// Copies the current URL (which encodes the view state) so any view is shareable.
export function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button onClick={share} className={copied ? 'share-btn copied' : 'share-btn'}>
      {copied ? '✓ link copied' : 'share view'}
    </button>
  )
}
