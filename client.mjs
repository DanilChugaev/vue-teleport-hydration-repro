// Same App component as the server (render functions — no SFC compiler needed).
// Picks the dev or prod browser build depending on the route.
const Vue = await import(location.pathname === '/dev' ? '/vue-dev.mjs' : '/vue.mjs')
const { createSSRApp, h, Teleport, createCommentVNode } = Vue

const App = {
  render: () => [
    h('div', { class: 'page' }, 'Hello from SSR'),
    h(Teleport, { to: 'body' }, [createCommentVNode()]), // v-if="false" content
  ],
}

createSSRApp(App).mount('#app')
console.log('[repro] mounted at', location.pathname)
