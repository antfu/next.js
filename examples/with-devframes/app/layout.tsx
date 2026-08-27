import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Devframes in Next DevTools",
  description:
    "Mount Devframe devtools as panels inside the Next.js DevTools indicator.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          lineHeight: 1.6,
          margin: "0 auto",
          maxWidth: "42rem",
          padding: "3rem 1.5rem",
        }}
      >
        {children}
      </body>
    </html>
  );
}
