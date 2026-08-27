import type { IncomingMessage, ServerResponse } from 'http'
import { pathToFileURL } from 'url'

import type { DevframeDock } from '../shared/devframe'
import { DEVFRAME_BASE, DEVFRAME_DOCKS_URL } from '../shared/devframe'
import { resolveDockIconMask, type DevframeDockIcon } from './devframe-icon'
import { middlewareResponse } from './middleware-response'

type NextFn = (err?: unknown) => void

/** One `experimental.devframes` entry: a package name, or a built devframe. */
export type DevframeConfigEntry = string | { id: string }

/**
 * The slice of `@devframes/hub`'s `HubInstance` used here, declared structurally
 * so `packages/next` takes no build-time dependency on a package the user
 * supplies at runtime.
 */
interface HubInstanceLike {
  nodeMiddleware: (
    req: IncomingMessage,
    res: ServerResponse,
    next?: NextFn
  ) => void
  ready: Promise<void>
  context: Promise<{
    docks: {
      values: () => Array<{
        id: string
        type: string
        title: string
        icon?: DevframeDockIcon
        url?: string
      }>
    }
  }>
}

/**
 * Load an ESM-only package the user installed, resolving it from `projectDir`:
 * Next is usually a symlink into a package store, so a bare `import()` here
 * would resolve against Next's real path and miss the user's dependencies.
 *
 * The non-literal specifier also keeps TypeScript from resolving a module that
 * is not a dependency here, and `taskfile-swc.js` sets `ignoreDynamic: true` so
 * this survives the CJS transform as a real `import()` rather than a `require()`.
 */
function importFromProject(
  projectDir: string,
  specifier: string
): Promise<any> {
  const resolved = pathToFileURL(
    require.resolve(specifier, { paths: [projectDir] })
  ).href
  return import(resolved)
}

function createHub(
  projectDir: string,
  devframes: readonly DevframeConfigEntry[]
): Promise<HubInstanceLike> {
  return importFromProject(projectDir, '@devframes/hub/initiate').then(
    ({ initHub }) =>
      initHub({
        name: 'next-devtools',
        base: DEVFRAME_BASE,
        cwd: projectDir,
        // An already-built devframe passes straight through. A package name
        // becomes a factory `initHub` calls during init — loaded with a native
        // `import()` because a devframe's node side spawns child processes and
        // resolves its SPA through `import.meta.url`.
        devframes: devframes.map((entry) =>
          typeof entry === 'string'
            ? () =>
                importFromProject(projectDir, entry).then((mod) =>
                  mod.default()
                )
            : entry
        ),
        // SSE only: it rides this middleware, so no WS upgrade plumbing.
        ws: false,
        // The dev server is the trust boundary; an OTP gate on a panel that
        // should just open is the wrong trade for a loopback dev surface.
        auth: false,
      })
  )
}

/** The hub's dock list, read node-side with each icon resolved to a mask. */
async function serveDocks(
  hub: HubInstanceLike,
  res: ServerResponse
): Promise<void> {
  await hub.ready
  const context = await hub.context

  const docks = await Promise.all(
    context.docks
      .values()
      // Other dock types need the renderer registry, which arrives with the
      // hub client runtime.
      .filter((entry) => entry.type === 'iframe' && entry.url)
      .map(async (entry): Promise<DevframeDock> => {
        const iconMask = await resolveDockIconMask(entry.icon)
        return {
          id: entry.id,
          title: entry.title,
          url: entry.url!,
          ...(iconMask ? { iconMask } : {}),
        }
      })
  )

  middlewareResponse.json(res, { docks })
}

/**
 * Apply a `writeHead` header array with `setHeader` instead.
 *
 * `router-server.ts` runs Next's vendored `compression` on every request, and
 * `on-headers@1.0.2` under it patches `writeHead` with a `setHeadersFromArray`
 * that assumes `[name, value]` tuples. Node documents the array form as flat
 * ("not a list of tuples"), which is what the hub's fetch-to-node bridge
 * passes, so every name and value is truncated to two characters
 * (`content-type` becomes the header `c: o`) and SPA assets arrive with no
 * `Content-Type`. Nothing patches `setHeader`, so routing through it is intact,
 * and compression still sees a real content type.
 *
 * Fixed upstream in `on-headers@1.1.0` (used by `compression@1.8.1`); bumping
 * the vendored copy would retire this and fix every other fetch-based handler.
 */
function applyHeadersWithoutWriteHead(res: ServerResponse): void {
  const originalWriteHead = res.writeHead.bind(res)

  res.writeHead = function writeHead(...args: any[]) {
    const index = args.findIndex((arg) => Array.isArray(arg))
    const flat = index === -1 ? undefined : (args[index] as string[])

    if (flat && flat.length % 2 === 0) {
      for (let i = 0; i < flat.length; i += 2) {
        res.setHeader(flat[i], flat[i + 1])
      }
      args.splice(index, 1)
    }

    return originalWriteHead(...(args as Parameters<typeof originalWriteHead>))
  } as ServerResponse['writeHead']
}

/**
 * Serve a Devframe hub from the dev server so Next DevTools can host devframes
 * as panels. Mounted only when `experimental.devframes` is non-empty, and inert
 * if the user has not also installed `@devframes/hub`.
 *
 * The hub boots on the first request under {@link DEVFRAME_BASE}, so a dev
 * server that never opens the panel pays nothing.
 */
export function getDevframeMiddleware({
  projectDir,
  devframes,
}: {
  projectDir: string
  devframes: readonly DevframeConfigEntry[]
}): (req: IncomingMessage, res: ServerResponse, next: NextFn) => Promise<void> {
  let hub: Promise<HubInstanceLike | null> | undefined

  return async function devframeMiddleware(req, res, next) {
    const pathname = req.url ?? '/'
    if (
      !pathname.startsWith(DEVFRAME_BASE) &&
      pathname !== DEVFRAME_BASE.slice(0, -1)
    ) {
      return next()
    }

    hub ??= createHub(projectDir, devframes).catch((error) => {
      console.error(
        'Next DevTools: could not start the Devframe hub. Install `@devframes/hub` alongside the devframes in `experimental.devframes`.',
        error
      )
      return null
    })

    const instance = await hub
    if (!instance) {
      return next()
    }

    // Next's own endpoint under the hub base, so answer it before delegating.
    if (pathname === DEVFRAME_DOCKS_URL) {
      try {
        return await serveDocks(instance, res)
      } catch (error) {
        return middlewareResponse.internalServerError(res, error)
      }
    }

    applyHeadersWithoutWriteHead(res)

    // `nodeMiddleware` calls `next()` synchronously for a path outside the hub
    // base and otherwise owns the response — what the dev middleware runner's
    // `calledNext` check expects.
    instance.nodeMiddleware(req, res, next)
  }
}
