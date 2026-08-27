import { useEffect, useState } from 'react'
import {
  DEVFRAME_INDEX_URL,
  type DevframeFrame,
} from '../../../shared/devframe'
import './devframe-panel.css'

/**
 * Lists the devframes mounted in the dev server's Devframe hub and shows the
 * selected one's SPA.
 *
 * Discovery is a plain `fetch` of the hub's `__index.json`, so this panel takes
 * no dependency on `@devframes/hub/client` and adds nothing to the pre-compiled
 * `next-devtools` bundle. Each SPA connects back to the hub over its own
 * `__connection.json` from inside the iframe.
 */
export function DevframePanel() {
  const [frames, setFrames] = useState<DevframeFrame[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(DEVFRAME_INDEX_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`the hub responded ${res.status}`)
        }
        return res.json()
      })
      .then((index: { frames?: DevframeFrame[] }) => {
        if (cancelled) return
        const mounted = index.frames ?? []
        setFrames(mounted)
        setSelectedId((current) => current ?? mounted[0]?.id ?? null)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error !== null) {
    return (
      <div className="devframe-panel-message">
        <p>Could not reach the Devframe hub — {error}.</p>
        <p>
          Start the dev server with <code>__NEXT_DEVFRAME=1</code> and install{' '}
          <code>@devframes/hub</code> with the devframes you want to mount.
        </p>
      </div>
    )
  }

  if (frames === null) {
    return <div className="devframe-panel-message">Connecting to the hub…</div>
  }

  if (frames.length === 0) {
    return (
      <div className="devframe-panel-message">
        The hub is running with no devframes mounted.
      </div>
    )
  }

  return (
    <div className="devframe-panel">
      {frames.length > 1 && (
        <div className="devframe-panel-rail" role="tablist">
          {frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              role="tab"
              className="devframe-panel-tab"
              aria-selected={frame.id === selectedId}
              data-selected={frame.id === selectedId}
              onClick={() => setSelectedId(frame.id)}
            >
              {frame.title}
            </button>
          ))}
        </div>
      )}
      <div className="devframe-panel-stage">
        {/*
          Every mounted devframe keeps its iframe alive and is hidden when
          inactive, so switching panels does not tear down a live session (a
          running shell in the terminals devframe, for one).
        */}
        {frames.map((frame) => (
          <iframe
            key={frame.id}
            className="devframe-panel-frame"
            src={frame.base}
            title={frame.title}
            hidden={frame.id !== selectedId}
          />
        ))}
      </div>
    </div>
  )
}
