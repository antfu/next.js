export default function Page() {
  return (
    <main>
      <h1>Devframes in Next DevTools</h1>

      <p>
        This app mounts two devframes. Open the Next.js logo in the corner of
        the page, then choose <strong>Devframe</strong>.
      </p>

      <ul>
        <li>
          <strong>Terminals</strong> — an interactive shell, mounted by package
          name with its default options.
        </li>
        <li>
          <strong>Data</strong> — a query workbench over registered data
          sources, built with its factory so it can be configured.
        </li>
      </ul>

      <p>
        Both run only under <code>next dev</code>. Edit the{" "}
        <code>experimental.devframes</code> list to change which ones mount.
      </p>
    </main>
  );
}
