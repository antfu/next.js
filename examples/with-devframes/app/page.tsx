/**
 * Deliberately inaccessible markup, so the A11y Inspector panel has real
 * violations to report. Do not copy any of this — each element is annotated
 * with the axe rule it breaks and how to fix it.
 */
function BrokenOnPurpose() {
  return (
    <section
      aria-label="Deliberate accessibility problems"
      style={{
        border: "1px solid #8885",
        padding: "8px 16px",
        borderRadius: 8,
      }}
    >
      <h4>A11y Examples</h4>

      <p>
        Open the <strong>A11y Inspector</strong> panel and it will list these,
        grouped by rule and severity. Delete this section to watch the count
        drop to zero.
      </p>

      {/* image-alt: an informative image with no text alternative.
          Fix: give it an `alt`, or `alt=""` if it is purely decorative. */}
      <img src="/next.svg" width={32} height={32} />

      {/* button-name: nothing accessible to announce.
          Fix: put text inside, or add an `aria-label`. */}
      <button type="button" style={{ width: 32, height: 32 }} />

      {/* link-name: an empty link.
          Fix: give the link text, or an `aria-label`. */}
      <a href="https://nextjs.org" />

      {/* label: a form control with no associated label.
          Fix: wrap it in a `<label>`, or point one at it with `htmlFor`. */}
      <input type="text" />
    </section>
  );
}

export default function Page() {
  return (
    <main>
      <h1>Devframes in Next DevTools</h1>

      <BrokenOnPurpose />

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
