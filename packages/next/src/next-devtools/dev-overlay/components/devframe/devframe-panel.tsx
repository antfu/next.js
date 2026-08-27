import { useEffect, useState } from 'react'
import {
  DEVFRAME_DOCKS_URL,
  type DevframeDock,
  type DevframeDocksResponse,
} from '../../../shared/devframe'
import './devframe-panel.css'

/**
 * Lists the devframes mounted in the dev server's Devframe hub and shows the
 * selected one's SPA.
 *
 * Discovery is a plain `fetch` of the dev server's dock endpoint, so this panel
 * takes no dependency on `@devframes/hub/client` and adds nothing to the
 * pre-compiled `next-devtools` bundle. Each SPA connects back to the hub over
 * its own `__connection.json` from inside the iframe.
 */
export function DevframePanel() {
  const [docks, setDocks] = useState<DevframeDock[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(DEVFRAME_DOCKS_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`the hub responded ${res.status}`)
        }
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
        <p>Could not reach the Devframe hub — {error}.</p>
        <p>
          Add devframes to <code>experimental.devframes</code> and install them
          alongside <code>@devframes/hub</code>.
        </p>
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
              <DockIcon dock={dock} />
              {dock.title}
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

/**
 * A dock's icon, painted as a `currentColor` mask so it follows the DevTools
 * theme. The dev server resolves the entry's Iconify id to the mask; when it
 * could not, fall back to the title's first letter rather than an empty box.
 */
function DockIcon({ dock }: { dock: DevframeDock }) {
  if (!dock.iconMask) {
    return (
      <span className="devframe-panel-tab-initial" aria-hidden="true">
        {dock.title.slice(0, 1)}
      </span>
    )
  }

  return (
    <span
      className="devframe-panel-tab-icon"
      aria-hidden="true"
      style={{ maskImage: `url("${dock.iconMask}")` }}
    />
  )
}
