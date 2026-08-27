/**
 * Mount base the Devframe hub answers under, following the `__nextjs_*`
 * convention of every other dev-only endpoint. Each mounted devframe serves its
 * SPA at `<base><id>/`, and hub discovery lives under the same base.
 *
 * These paths are handled by the dev middleware chain, which runs before
 * `resolveRoutes` in `router-server.ts` — so the trailing slash the SPAs need is
 * never touched by Next's trailing-slash redirect.
 */
export const DEVFRAME_BASE = '/__nextjs_devframe/'

/**
 * Dock listing for the DevTools panel, served by the dev server.
 *
 * The hub publishes its docks as `devframe:docks` shared state, which needs an
 * RPC client; this endpoint is the same list read from the hub context on the
 * node side, with each icon already resolved. That keeps
 * `@devframes/hub/client` out of the pre-compiled overlay bundle.
 */
export const DEVFRAME_DOCKS_URL = `${DEVFRAME_BASE}__nextjs_docks.json`

/** One dock the panel can show, as served by {@link DEVFRAME_DOCKS_URL}. */
export interface DevframeDock {
  id: string
  title: string
  /** Absolute, trailing-slashed path of this devframe's SPA. */
  url: string
  /**
   * `data:` URI for a CSS `mask-image`, painted with `currentColor` so the icon
   * follows the DevTools theme. Absent when the icon could not be resolved, and
   * the panel falls back to a text initial.
   */
  iconMask?: string
}

export interface DevframeDocksResponse {
  docks: DevframeDock[]
}
