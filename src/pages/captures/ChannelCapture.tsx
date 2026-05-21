import { useState, useEffect } from 'react'
import { useCaptureStore } from '@/hooks/useCaptureStore'

export function ChannelCapture() {
  const { captures, isLoading, loadCaptures } = useCaptureStore()
  const [_ready, setReady] = useState(false)

  useEffect(() => {
    loadCaptures().then(() => setReady(true))
  }, [loadCaptures])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: '14px' }}>
        Loading captures…
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Channel Capture</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
        {captures.length} capture{captures.length !== 1 ? 's' : ''} — full UI loading…
      </p>
    </div>
  )
}
