import type { IncomingMessage, ServerResponse } from 'http'
import { pathToFileURL } from 'url'

import { DEVFRAME_BASE } from '../shared/devframe'

type NextFn = (err?: unknown) => void

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

function createHub(
  projectDir: string,
  devframes: readonly string[]
): Promise<HubInstanceLike> {
  return importFromProject(projectDir, '@devframes/hub/initiate').then(
    ({ initHub }) =>
      initHub({
        name: 'next-devtools',
        base: DEVFRAME_BASE,
        cwd: projectDir,
        // `initHub` resolves factory entries itself, so each devframe package
        // loads lazily during hub init rather than blocking this call.
        // Each entry is loaded with a native `import()` rather than a static one:
        // a devframe's node side spawns child processes and resolves its SPA
        // assets through `import.meta.url`, and these are ESM-only packages the
        // user installs. `initHub` resolves factory entries itself, so each one
        // loads during hub init rather than blocking this call.
        devframes: devframes.map(
          (pkg) => () =>
            importFromProject(projectDir, pkg).then((mod) => mod.default())
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
  /** Package names from `experimental.devframes`. */
  devframes: readonly string[]
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
        `Next DevTools: could not start the Devframe hub. Install it with \`npm i -D @devframes/hub ${devframes.join(' ')}\`.`,
        error
      )
      return null
    })

    const instance = await hub
    if (!instance) {
      return next()
    }

    applyHeadersWithoutWriteHead(res)

    // `nodeMiddleware` calls `next()` synchronously for a path outside the hub
    // base and otherwise owns the response, which is exactly what the dev
    // middleware runner's `calledNext` check expects.
    instance.nodeMiddleware(req, res, next)
  }
}
