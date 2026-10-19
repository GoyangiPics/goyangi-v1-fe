/**
 * The homepage's link preview.
 *
 * `/` is an SPA route, so the HTML Discord fetches is the bare shell and nothing
 * a page component sets reaches it. nuxt.config's head can't carry these tags
 * either: it's that same shell for every SPA route, and a site-wide card on
 * /collections or /labels was the thing to get rid of. So they're added here,
 * for the one path that should unfurl without its own SSR.
 *
 * Constant strings only — nothing from the request goes into the markup.
 */
const HOME_HEAD = [
  '<title>goyangi</title>',
  '<meta name="description" content="K-pop pics, gifs and videos to browse, like and collect.">',
  '<meta property="og:site_name" content="🐱 goyangi.pics">',
].join('')

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (getRequestURL(event).pathname !== '/') return
    html.head.push(HOME_HEAD)
  })
})
