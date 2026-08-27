/**
 * Mount base for the Devframe hub, following the `__nextjs_*` convention. Each
 * devframe's SPA is served at `<base><id>/`.
 *
 * The dev middleware chain runs before `resolveRoutes` in `router-server.ts`,
 * so the trailing slash the SPAs need survives Next's trailing-slash redirect.
 */
export const DEVFRAME_BASE = '/__nextjs_devframe/'

/**
 * Dock listing for the panel. The hub publishes docks as `devframe:docks`
 * shared state, which needs an RPC client; serving the same list from the node
 * side keeps `@devframes/hub/client` out of the pre-compiled overlay bundle.
 */
export const DEVFRAME_DOCKS_URL = `${DEVFRAME_BASE}__nextjs_docks.json`

export interface DevframeDock {
  id: string
  title: string
  /** Absolute, trailing-slashed path of this devframe's SPA. */
  url: string
  /** `mask-image` data URI, painted with `currentColor`. Absent if unresolved. */
  iconMask?: string
}

export interface DevframeDocksResponse {
  docks: DevframeDock[]
}
