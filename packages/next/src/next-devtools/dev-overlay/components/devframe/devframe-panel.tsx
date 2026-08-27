import { useEffect, useState } from 'react'
import {
  DEVFRAME_DOCKS_URL,
  type DevframeDock,
  type DevframeDocksResponse,
} from '../../../shared/devframe'
import './devframe-panel.css'

/**
 * Lists the devframes mounted in the dev server's hub and shows the selected
 * one's SPA. Discovery is a plain `fetch`, so this adds no devframe code to the
 * pre-compiled `next-devtools` bundle; each SPA connects back to the hub itself.
 */
export function DevframePanel() {
  const [docks, setDocks] = useState<DevframeDock[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(DEVFRAME_DOCKS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`the hub responded ${res.status}`)
        return res.json()
      })
      .then((payload: DevframeDocksResponse) => {
        if (cancelled) return
        const mounted = payload.docks ?? []
        setDocks(mounted)
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
        Could not reach the Devframe hub — {error}. Check the terminal for the
        reason.
      </div>
    )
  }

  if (docks === null) {
    return <div className="devframe-panel-message">Connecting to the hub…</div>
  }

  if (docks.length === 0) {
    return (
      <div className="devframe-panel-message">
        The hub is running with no devframes mounted.
      </div>
    )
  }

  return (
    <div className="devframe-panel">
      {docks.length > 1 && (
        <div className="devframe-panel-rail" role="tablist">
          {docks.map((dock) => (
            <button
              key={dock.id}
              type="button"
              role="tab"
              className="devframe-panel-tab"
              aria-selected={dock.id === selectedId}
              data-selected={dock.id === selectedId}
              onClick={() => setSelectedId(dock.id)}
            >
              <span
                aria-hidden="true"
                className={
                  dock.iconMask
                    ? 'devframe-panel-tab-icon'
                    : 'devframe-panel-tab-initial'
                }
                style={
                  dock.iconMask
                    ? { maskImage: `url("${dock.iconMask}")` }
                    : undefined
                }
              >
                {dock.iconMask ? null : dock.title.slice(0, 1)}
              </span>
              {dock.title}
            </button>
          ))}
        </div>
      )}
      <div className="devframe-panel-stage">
        {/* Kept alive and hidden when inactive, so switching docks does not
            tear down a live session (a running shell, for one). */}
        {docks.map((dock) => (
          <iframe
            key={dock.id}
            className="devframe-panel-frame"
            src={dock.url}
            title={dock.title}
            hidden={dock.id !== selectedId}
          />
        ))}
      </div>
    </div>
  )
}
