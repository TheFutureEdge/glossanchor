# Next.js Example Build Notes

Verified on 2026-08-03 with Next.js 16.2.12 and React 19.2.8.

- `/` is emitted as static HTML.
- `/terms/q-t` is emitted as an SSG page with an existing
  `#term-sample-rate` fragment target.
- The root package and example production audits report zero vulnerabilities.
- Library gzip sizes used by this example are: core 1,822 bytes, React 1,187
  bytes, optional interaction 972 bytes, and glossary helpers 717 bytes.
- The core-only export has no React or interaction import. Progressive
  enhancement is loaded only by the explicit client interaction component.

Run `npm ci && npm run build` in this directory to reproduce the build.
