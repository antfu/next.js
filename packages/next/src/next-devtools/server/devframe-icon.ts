/**
 * Resolve a dock's Iconify id (`ph:terminal-window-duotone`) to a `data:` URI
 * for CSS `mask-image`, following devframe's `design/dock-icon.ts`.
 *
 * That reference fetches SVG in the browser and sanitizes it with DOMPurify.
 * Resolving here and handing the overlay a mask instead means no third-party
 * markup is injected, so no sanitizer is needed; a mask also reads the source's
 * alpha, which keeps duotone icons intact, and paints through `currentColor`,
 * so icons follow the DevTools theme.
 */

/** Iconify ids, tolerating the UnoCSS-style `i-` prefix like the reference. */
const ICONIFY_ID = /^(?:i-)?([\w-]+):([\w-]+)$/

/** Resolved lookups. A failure is dropped rather than cached, so it can retry. */
const cache = new Map<string, Promise<string | undefined>>()

export type DevframeDockIcon = string | { light: string; dark: string }

/** `undefined` when the id doesn't parse or the fetch fails; callers fall back. */
export function resolveDockIconMask(
  icon: DevframeDockIcon | undefined
): Promise<string | undefined> {
  // A `{ light, dark }` pair collapses to one entry — `currentColor` already
  // supplies both variants.
  const id = typeof icon === 'string' ? icon : icon?.light
  const match = id?.match(ICONIFY_ID)
  if (!match) {
    return Promise.resolve(undefined)
  }

  const key = `${match[1]}:${match[2]}`
  let pending = cache.get(key)
  if (!pending) {
    pending = fetchIconMask(match[1], match[2]).catch(() => {
      cache.delete(key)
      return undefined
    })
    cache.set(key, pending)
  }
  return pending
}

async function fetchIconMask(
  collection: string,
  icon: string
): Promise<string | undefined> {
  // No `color` param: a mask reads alpha, so the source's own fill is moot.
  const response = await fetch(
    `https://api.iconify.design/${collection}/${icon}.svg?width=100%`,
    { signal: AbortSignal.timeout(4000) }
  )
  const svg = response.ok ? await response.text() : ''
  // Iconify answers a miss with a body, so check we really got an SVG.
  return svg.trimStart().startsWith('<svg')
    ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    : undefined
}
