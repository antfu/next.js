/**
 * Resolve a devframe dock icon to markup Next DevTools can render.
 *
 * Ported from devframe's own `design/dock-icon.ts`, which is a framework-neutral
 * port of `@antfu/design`'s `DisplayIconifyRemoteIcon`. Dock entries name their
 * icon as an Iconify `collection:icon` id (`ph:terminal-window-duotone`), so any
 * icon works without installing an `@iconify-json/*` collection — at the cost of
 * one network round-trip per icon, cached for the life of the dev server.
 *
 * Where the reference fetches SVG markup in the browser and sanitizes it with
 * DOMPurify, this resolves it in the dev server and hands the overlay a `data:`
 * URI to use as a CSS `mask-image`. The overlay never injects third-party
 * markup, and no sanitizer is needed: an SVG used as a mask cannot run script.
 * Masking also keeps duotone icons intact — the mask reads the source's alpha,
 * so a duotone's low-opacity layer stays low-opacity — and paints through
 * `currentColor`, so icons follow the DevTools theme.
 */

/** Iconify ids, tolerating the UnoCSS-style `i-` prefix like the reference. */
const ICONIFY_ID = /^(?:i-)?([\w-]+):([\w-]+)$/

/**
 * In-flight and resolved lookups keyed by `collection:icon`. A failed lookup is
 * dropped rather than cached, so a later render can retry after the network
 * comes back.
 */
const cache = new Map<string, Promise<string | undefined>>()

/** Give up rather than hold a dock row's icon on a slow or hanging CDN. */
const FETCH_TIMEOUT_MS = 4000

export type DevframeDockIcon = string | { light: string; dark: string }

/**
 * Resolve a dock icon to a `data:` URI for CSS `mask-image`, or `undefined` when
 * the id does not parse or the icon cannot be fetched — the caller then falls
 * back to a text initial, as the reference does.
 */
export function resolveDockIconMask(
  icon: DevframeDockIcon | undefined
): Promise<string | undefined> {
  // A `{ light, dark }` pair collapses to one entry: the mask is painted with
  // `currentColor`, so the DevTools theme already supplies both variants.
  const id = typeof icon === 'string' ? icon : icon?.light
  if (!id) {
    return Promise.resolve(undefined)
  }

  const match = id.match(ICONIFY_ID)
  if (!match) {
    return Promise.resolve(undefined)
  }

  const key = `${match[1]}:${match[2]}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const pending = fetchIconMask(match[1], match[2]).catch(() => {
    cache.delete(key)
    return undefined
  })
  cache.set(key, pending)
  return pending
}

async function fetchIconMask(
  collection: string,
  icon: string
): Promise<string | undefined> {
  // `width=100%` lets the mask scale to whatever box the overlay gives it. No
  // `color` param: a mask reads alpha, so the source's own fill is irrelevant.
  const url = `https://api.iconify.design/${collection}/${icon}.svg?width=100%`

  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    return undefined
  }

  const svg = await response.text()
  // Iconify answers 404s with a body, so check we really got an SVG.
  if (!svg.trimStart().startsWith('<svg')) {
    return undefined
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
