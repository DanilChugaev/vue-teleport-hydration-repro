// Repro server: no bundler needed.
//
// The SSR'd page contains an enabled <Teleport to="body"> whose content is
// empty (v-if="false" on the server) — so <body> gets NO
// <!--teleport start anchor--> / <!--teleport anchor--> markup.
//
// On client hydration, hydrateTeleport() starts scanning
// nextSibling(body._lpa || body.firstChild) for the teleport's children.
// Because <body> begins with whitespace before #app (indented template,
// like VuePress), the scan lands on div#app itself and the mismatch
// "handling" REMOVES #app from the document.
//
// Routes:
//   /        prod build -> blank page, console is silent
//   /dev     dev build  -> blank page + the exact hydration warning
//   /nowrap  no leading whitespace before #app -> page SURVIVES (warning only)
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createSSRApp, h, Teleport, createCommentVNode } from 'vue'
import { renderToString } from '@vue/server-renderer'

const VUE_DIST = 'node_modules/vue/dist'

// Root = fragment [element, <Teleport to="body"> with empty content].
// The Teleport must be a DIRECT child of the hydrated fragment (the shape
// VuePress/theme-default produces). Wrapping it in a component instead
// makes it fresh-mount (not hydrate) and avoids the bug.
const App = {
  render: () => [
    h('div', { class: 'page' }, 'Hello from SSR'),
    h(Teleport, { to: 'body' }, [createCommentVNode()]), // v-if="false" content
  ],
}

const ssrHtml = await renderToString(createSSRApp(App))
console.log('SSR output:', ssrHtml)

const head = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Repro: empty &lt;Teleport to="body"&gt; breaks hydration (Vue &gt;= 3.5.0)</title>
    <style>
      body { font-family: system-ui; }
      .page { padding: 24px; }
    </style>
  </head>
`
const foot = `</html>`

// The leading whitespace before <div id="app"> is part of the trigger:
// it makes body.firstChild a *text* node, so the scan lands on #app.
const html = (indented) =>
  indented
    ? `${head}  <body>
    <div id="app">${ssrHtml}</div>
    <script type="module" src="/client.mjs"></script>
  </body>
${foot}`
    : `${head}  <body><div id="app">${ssrHtml}</div><script type="module" src="/client.mjs"></script></body>
${foot}`

const routes = { '/': true, '/dev': true, '/nowrap': false }

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (routes[url.pathname] !== undefined) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(html(routes[url.pathname]))
  }
  const files = {
    '/client.mjs': './client.mjs',
    '/vue.mjs': `${VUE_DIST}/vue.esm-browser.prod.js`,
    '/vue-dev.mjs': `${VUE_DIST}/vue.esm-browser.js`,
  }
  if (files[url.pathname]) {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
    return res.end(readFileSync(files[url.pathname]))
  }
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('not found')
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Repro server on http://localhost:${port}`)
  console.log('  /        -> prod build: expect a BLANK page (silent)')
  console.log('  /dev     -> dev build:  expect a blank page + hydration warning')
  console.log('  /nowrap  -> no whitespace before #app: page survives (warning only)')
})
