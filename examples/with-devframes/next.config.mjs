import createA11y, { a11yPageScriptBundlePath } from "@devframes/plugin-a11y";
import createDataInspector from "@devframes/plugin-data-inspector";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Devframes to mount in Next DevTools. Each becomes a panel behind the
    // Next.js logo, served under `/__nextjs_devframe/<id>/`. Dev only — an
    // empty or absent list turns the feature off entirely.
    devframes: [
      // A package name mounts a devframe with its default options.
      "@devframes/plugin-terminals",
      "@devframes/plugin-inspect",
      "@devframes/plugin-code-server",

      // Build one with its own factory to configure it. The Data Inspector
      // needs this: its default id is `devframes:plugin:data-inspector`, and a
      // mount path segment can't contain `:`, so give it a path-safe id.
      createDataInspector({
        id: "data-inspector",
        name: "Data",
        icon: "ph:magnifying-glass-duotone",
      }),

      // The a11y inspector scans the app's own DOM, so it ships a page script.
      // Point the dock at the bundle and the dev server serves it, then boots
      // it in the page for the panel to talk to.
      {
        devframe: createA11y(),
        dock: { clientScript: { importFrom: a11yPageScriptBundlePath } },
      },
    ],
  },
};

export default nextConfig;
