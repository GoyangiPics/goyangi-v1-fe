// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en', class: 'dark' },
      // No titleTemplate here: a string template with no %s replaced every
      // page's title with the literal word. The template is a function now, in
      // app.vue — head config in this file has to be serialisable.
      title: 'goyangi',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'K-pop pics, gifs and videos to browse, like and collect.',
        },
        // night-950 (oklch(0.145 0.012 340)) — keep in sync with main.css
        // and public/site.webmanifest.
        { name: 'theme-color', content: '#0e080c' },
        { name: 'apple-mobile-web-app-title', content: 'goyangi' },
        { property: 'og:site_name', content: '🐱 goyangi.pics' },
      ],
      link: [
        // Modern minimal favicon set (see public/): SVG for modern browsers,
        // PNG/ICO fallbacks, apple-touch-icon for iOS, manifest for Android.
        { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },
  routeRules: {
    '/home': { redirect: '/' },
    // SPA by default; opt specific routes into SSR for SEO/social previews.
    '/**': { ssr: false },
    '/single/**': { ssr: true },
    '/set/**': { ssr: true },
    '/collection/**': { ssr: true },
    // Legal pages must be readable by non-browser fetchers — Discord's app
    // review checks the Privacy Policy / ToS URLs, and an SPA shell is empty.
    '/privacy': { ssr: true },
    '/terms': { ssr: true },
    '/takedown': { ssr: true },
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt',
  ],
  ui: {
    // Dark-only app — the `dark` class is pinned on <html> above, so skip
    // the color-mode module entirely.
    colorMode: false,
  },
  fonts: {
    families: [
      { name: 'Inter', weights: [400, 500, 600, 700] },
      // Display face for headings (see --font-display in main.css).
      { name: 'Outfit', weights: [500, 600, 700] },
    ],
  },
  piniaPluginPersistedstate: {
    // The Nuxt module defaults to cookies (SSR-safe but 4 KB limit).
    // Our filter/settings state can be larger than that, and isn't needed
    // server-side, so localStorage is the right fit.
    storage: 'localStorage',
  },
  // The sitemap is served by server/routes/sitemap.xml.get.ts and
  // server/routes/sitemaps/[name].get.ts — an index over chunked sitemaps,
  // built from a couple of API calls each. @nuxtjs/sitemap's single-source
  // design walked every record per request, which on Cloudflare Workers ran
  // past the CPU budget and answered 503 (error 1102).
  css: ['@/assets/main.css', '@/assets/cards.css'],
  vite: {
    // @nuxt/ui registers the Tailwind Vite plugin itself.
    optimizeDeps: {
      // Pre-bundle runtime deps discovered late (avoids a dev-server reload).
      include: ['pocketbase'],
    },
  },
  typescript: {
    tsConfig: {
      // The unit tests (vp test) live outside app/, so nothing type-checked
      // them. They import app code through `~`, so the app project fits.
      include: ['../test/**/*'],
    },
  },
  runtimeConfig: {
    public: {
      hostUrl: 'https://cdn.goyangi.pics/',
      baseUrl: 'https://api.goyangi.pics/',
      appVersion: 'v1.4 — 2026-10-09',
      // The public origin, for anything that has to emit absolute URLs on the
      // server: the sitemap. NUXT_PUBLIC_SITE_URL overrides it for a staging deploy.
      siteUrl: 'https://goyangi.pics',
      // Contact routes for upload-access requests. In runtimeConfig rather than
      // inlined so a staging deploy can point at a different Discord without a
      // code change (NUXT_PUBLIC_DISCORD_INVITE / NUXT_PUBLIC_SUPPORT_EMAIL).
      discordInvite: 'https://discord.gg/BmWMXFrZeK',
      supportEmail: 'goyangi.pics@protonmail.com',
    },
  },
})
