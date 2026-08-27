# Devframes in Next DevTools example

[Devframe](https://devfra.me/) is a framework-neutral foundation for building devtools. This example mounts Devframe devtools as panels inside the Next.js DevTools indicator: open the Next.js logo in the corner of the page and choose **Devframe**.

Five devframes are mounted, covering every way to declare one:

- **Terminals** ([`@devframes/plugin-terminals`](https://devfra.me/plugins/terminals)) — an interactive shell in a panel.
- **Inspect** ([`@devframes/plugin-inspect`](https://devfra.me/plugins/inspect)) — the module graph and transform pipeline.
- **Code Server** ([`@devframes/plugin-code-server`](https://devfra.me/plugins/code-server)) — an embedded editor for this project.
- **Data** ([`@devframes/plugin-data-inspector`](https://devfra.me/plugins/data-inspector)) — a [jora](https://discoveryjs.github.io/jora/) query workbench, built with its factory so it can be configured.
- **A11y Inspector** ([`@devframes/plugin-a11y`](https://devfra.me/plugins/a11y)) — [axe-core](https://github.com/dequelabs/axe-core) run against this app, through a page script.

> This uses `experimental.devframes`, which is unreleased — hence `next: canary` in `package.json`.

## Deploy your own

Devframes run only under `next dev`, so there is nothing devtools-related to deploy. The app itself deploys like any other Next.js app.

## How to use

Execute [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) with [npm](https://docs.npmjs.com/cli/init), [Yarn](https://yarnpkg.com/lang/en/docs/cli/create/), or [pnpm](https://pnpm.io) to bootstrap the example:

```bash
npx create-next-app --example with-devframes with-devframes-app
```

```bash
yarn create next-app --example with-devframes with-devframes-app
```

```bash
pnpm create next-app --example with-devframes with-devframes-app
```

Then start the dev server and open the DevTools indicator:

```bash
npm run dev
```

## Configuring which devframes mount

`experimental.devframes` takes a list, and an entry comes in two forms.

A **package name** mounts a devframe with its default options:

```js
// next.config.mjs
export default {
  experimental: {
    devframes: ["@devframes/plugin-terminals"],
  },
};
```

A **devframe built by its own factory** lets you configure it:

```js
// next.config.mjs
import createDataInspector from "@devframes/plugin-data-inspector";

export default {
  experimental: {
    devframes: [
      createDataInspector({
        id: "data-inspector",
        name: "Data",
        icon: "ph:magnifying-glass-duotone",
      }),
    ],
  },
};
```

A devframe that inspects the app's own DOM ships a **page script** to run in the page. Point its dock at the bundle and the dev server serves it, then boots it before the panel opens:

```js
// next.config.mjs
import createA11y, { a11yPageScriptBundlePath } from "@devframes/plugin-a11y";

export default {
  experimental: {
    devframes: [
      {
        devframe: createA11y(),
        dock: { clientScript: { importFrom: a11yPageScriptBundlePath } },
      },
    ],
  },
};
```

Install each devframe yourself, alongside `@devframes/hub`:

```bash
npm i -D @devframes/hub @devframes/plugin-terminals
```

An empty or absent list turns the feature off entirely — no panel, no hub, and `/__nextjs_devframe/*` returns 404.

### Ids become mount paths

Each devframe is served at `/__nextjs_devframe/<id>/`, so its id has to be a valid path segment. Some devframes default to a namespaced id containing `:` — the Data Inspector defaults to `devframes:plugin:data-inspector` — which is why this example passes it an `id`. Mounting one whose id contains `:` fails with [`DF8004`](https://devfra.me/errors/DF8004).

### Other devframes

Devframe ships several more ([full list](https://devfra.me/plugins)), including a Git browser, an Open Graph previewer, and an asset browser.

**Some devframes spawn processes or expose a shell on the dev server, so only list ones you trust.** Terminals in this example is one of them: it runs commands on your machine. It denies arbitrary commands by default, allowing only your own shell and any `presets` you configure:

```js
createTerminals({
  presets: [
    { id: "build", title: "next build", command: "next", args: ["build"] },
  ],
});
```

## How it works

The dev server runs one [`@devframes/hub`](https://devfra.me/guide/hub) instance, mounted on the dev middleware chain under `/__nextjs_devframe/`:

- `/__nextjs_devframe/<id>/` — each devframe's SPA
- `/__nextjs_devframe/__connection.json` — transport discovery
- `/__nextjs_devframe/__sse` — the RPC transport

The hub boots on the first request to that base, so a dev server that never opens the panel pays nothing for it.
