import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAutoSync, takeSyncLinkFromUrl } from './logic/jarvisSync'

// Ask the browser not to evict IndexedDB under storage pressure.
navigator.storage?.persist?.().catch(() => {})

// A link from Jarvis (#jarvis-sync=...) is read and removed before the router sees the hash.
// Nothing is stored until the user confirms it.
const jarvisLink = takeSyncLinkFromUrl()
// Sends the backup to Jarvis after changes; does nothing until a Jarvis link is connected.
startAutoSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App jarvisLink={jarvisLink} />
  </StrictMode>,
)
