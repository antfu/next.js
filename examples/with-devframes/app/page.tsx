export default function Page() {
  return (
    <main>
      <h1>Devframes in Next DevTools</h1>

      <p>
        This app mounts four devframes. Open the Next.js logo in the corner of
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
          <strong>Data</strong> — a query workbench, the one built with its
          factory so it can be configured.
        </li>
      </ul>

      <p>
        All run only under <code>next dev</code>. Edit the{" "}
        <code>experimental.devframes</code> list to change which ones mount.
      </p>
    </main>
  );
}
