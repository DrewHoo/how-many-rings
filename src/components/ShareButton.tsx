import { useShare } from '../hooks/useShare.ts'

/**
 * Shares the current URL (which encodes the view) with one quotable sentence:
 * the open person's line when someone is open, else the page's own.
 */
export function ShareButton({ text, open }: { text: string; open: string | null }) {
  const { copied, share } = useShare()
  return (
    <button className={copied ? 'share-btn copied' : 'share-btn'}
      onClick={() => share(text, window.location.href, { open, from: 'filters' })}>
      {copied ? '✓ copied' : 'share'}
    </button>
  )
}
