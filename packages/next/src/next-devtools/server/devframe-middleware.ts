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
 * The slice of `@devframes/hub`'s `HubInstance` this middleware drives. Declared
 * structurally rather than imported so `packages/next` takes no build-time
 * dependency on a package the user supplies at runtime.
 */
interface HubInstanceLike {
  nodeMiddleware: (
    req: IncomingMessage,
    res: ServerResponse,
    next?: NextFn
  ) => void
  /** Resolves once every devframe is mounted and its dock registered. */
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
 * Load an ESM-only package the user installed, resolving it from `projectDir`
 * rather than from Next's own location. Next is usually a symlink into a
 * package store, so a bare `import()` here would resolve against Next's real
 * path and miss the user's dependencies entirely.
 *
 * The non-literal specifier also keeps TypeScript from resolving a module that
 * is not a dependency of this package, and `taskfile-swc.js` sets
 * `ignoreDynamic: true` so the call survives the CJS transform as a real
 * dynamic `import()` instead of becoming a `require()`.
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
        // A devframe already built by its factory is passed straight through,
        // options and all. A package name becomes a factory `initHub` calls
        // during init: loading it with a native `import()` rather than a static
        // one matters, because a devframe's node side spawns child processes and
        // resolves its SPA assets through `import.meta.url`, and these are
        // ESM-only packages the user installs.
        devframes: devframes.map((entry) =>
          typeof entry === 'string'
            ? () =>
                importFromProject(projectDir, entry).then((mod) =>
                  mod.default()
                )
            : entry
        ),
        // SSE only. It rides this middleware like every other hub route, so the
        // MVP needs no WebSocket upgrade plumbing in the dev server.
        ws: false,
        // The dev server is the trust boundary here; an OTP gate on a panel that
        // should just open is the wrong trade for a dev-only, loopback surface.
        auth: false,
      })
  )
}

/**
 * Answer {@link DEVFRAME_DOCKS_URL} from the hub context: the same dock list the
 * hub publishes as `devframe:docks`, read node-side so the overlay needs no RPC
 * client, with every icon resolved to a mask a themed rail can paint.
 */
async function serveDocks(
  hub: HubInstanceLike,
  res: ServerResponse
): Promise<void> {
  await hub.ready
  const context = await hub.context

  const docks = await Promise.all(
    context.docks
      .values()
      // The MVP panel renders iframe docks; every other type needs a renderer
      // registry, which arrives with the hub client runtime.
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
 * Work around header corruption for hub responses.
 *
 * `router-server.ts` runs Next's vendored `compression` on every request, and
 * `on-headers@1.0.2` underneath it patches `res.writeHead` with a
 * `setHeadersFromArray` that assumes an array of `[name, value]` tuples. Node
 * documents the array form as flat — `[name, value, name, value]`, "not a list
 * of tuples" — which is what the hub's fetch-to-node bridge passes. Every name
 * and value is then truncated to its first two characters (`content-type`
 * becomes the header `c: o`), so SPA assets arrive with no `Content-Type` and
 * the browser refuses to execute their module scripts.
 *
 * Lift a flat array out of the `writeHead` call and apply it with `setHeader`
 * instead, which nothing in that chain patches. Compression then reads a real
 * content type when it decides whether to transform the body.
 *
 * The general fix is upstream: `on-headers@1.1.0` distinguishes 1D from 2D
 * arrays and `compression@1.8.1` depends on it. Bumping the vendored copy would
 * make this shim unnecessary and fix the same corruption for every other
 * fetch-based handler mounted in the dev server.
 */
function applyHeadersWithoutWriteHead(res: ServerResponse): void {
  const originalWriteHead = res.writeHead.bind(res)

  res.writeHead = function writeHead(...args: any[]) {
    const index = args.findIndex((arg) => Array.isArray(arg))

    if (index !== -1) {
      const flat = args[index] as string[]
      if (flat.length % 2 === 0) {
        for (let i = 0; i < flat.length; i += 2) {
          res.setHeader(flat[i], flat[i + 1])
        }
        args.splice(index, 1)
      }
    }

    return originalWriteHead(...(args as Parameters<typeof originalWriteHead>))
  } as ServerResponse['writeHead']
}

/**
 * Serve a Devframe hub from the dev server, so Next DevTools can host devframes
 * as panels. Callers mount this only when `experimental.devframes` is non-empty;
 * it stays inert if the user has not also installed `@devframes/hub`.
 *
 * The hub boots on the first request under {@link DEVFRAME_BASE} rather than at
 * dev-server startup, so a dev server that never opens the panel pays nothing.
 */
export function getDevframeMiddleware({
  projectDir,
  devframes,
}: {
  projectDir: string
  /** Entries from `experimental.devframes`. */
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
      const packages = devframes
        .filter((entry): entry is string => typeof entry === 'string')
        .join(' ')
      console.error(
        `Next DevTools: could not start the Devframe hub. Install it with \`npm i -D @devframes/hub${packages ? ` ${packages}` : ''}\`.`,
        error
      )
      return null
    })

    const instance = await hub
    if (!instance) {
      return next()
    }

    // Answer the dock listing before delegating: it is Next's own endpoint under
    // the hub base, so the hub would otherwise 404 it.
    if (pathname === DEVFRAME_DOCKS_URL) {
      try {
        return await serveDocks(instance, res)
      } catch (error) {
        return middlewareResponse.internalServerError(res, error)
      }
    }

    applyHeadersWithoutWriteHead(res)

    // `nodeMiddleware` calls `next()` synchronously for a path outside the hub
    // base and otherwise owns the response, which is exactly what the dev
    // middleware runner's `calledNext` check expects.
    instance.nodeMiddleware(req, res, next)
  }
}
