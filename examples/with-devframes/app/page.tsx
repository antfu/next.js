export default function Page() {
  return (
    <main>
      <h1>Devframes in Next DevTools</h1>

      <p>
        This app mounts five devframes. Open the Next.js logo in the corner of
        the page, then choose <strong>Devframe</strong>.
      </p>

      <ul>
        <li>
          <strong>Terminals</strong> — an interactive shell.
        </li>
        <li>
          <strong>Inspect</strong> — the module graph and transform pipeline.
        </li>
        <li>
          <strong>Code Server</strong> — an embedded editor for this project.
        </li>
        <li>
          <strong>Data</strong> — a query workbench, built with its factory so
          it can be configured.
        </li>
        <li>
          <strong>A11y Inspector</strong> — axe-core run against this page, via
          a page script the dev server boots.
        </li>
      </ul>

      <p>
        All run only under <code>next dev</code>. Edit the{" "}
        <code>experimental.devframes</code> list to change which ones mount.
      </p>
    </main>
  );
}
