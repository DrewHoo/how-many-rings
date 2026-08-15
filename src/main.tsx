import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import type { Dataset } from './lib/types.ts'

// The prerender step injects a trimmed top-100 payload and the markup rendered
// from it. Hydrating against that same seed means the server and client first
// render are identical; the full 741KB dataset arrives afterwards.
const seedEl = document.getElementById('seed-data')
const seed: Dataset | undefined = seedEl ? JSON.parse(seedEl.textContent!) : undefined
const root = document.getElementById('root')!

const tree = (
  <StrictMode>
    <App initialData={seed} />
  </StrictMode>
)

seed ? hydrateRoot(root, tree) : createRoot(root).render(tree)
