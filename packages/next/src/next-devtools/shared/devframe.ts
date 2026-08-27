/**
 * Mount base the Devframe hub answers under, following the `__nextjs_*`
 * convention of every other dev-only endpoint. Each mounted devframe serves its
 * SPA at `<base><id>/`, and hub discovery lives at `<base>__index.json`.
 *
 * These paths are handled by the dev middleware chain, which runs before
 * `resolveRoutes` in `router-server.ts` — so the trailing slash the SPAs need is
 * never touched by Next's trailing-slash redirect.
 */
export const DEVFRAME_BASE = '/__nextjs_devframe/'

/** Hub discovery document: the mounted-devframe index and endpoint map. */
export const DEVFRAME_INDEX_URL = `${DEVFRAME_BASE}__index.json`

/** One mounted devframe, as reported by {@link DEVFRAME_INDEX_URL}. */
export interface DevframeFrame {
  id: string
  /** Absolute, trailing-slashed path this devframe's SPA is served at. */
  base: string
  title: string
}
