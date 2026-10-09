<script setup lang="ts">
// Everything else on this page is inline template data on purpose — it is a
// static page. These two are config so the contact routes live in one place
// (see nuxt.config.ts runtimeConfig.public).
useHead({ title: 'About' })

const { discordInvite, supportEmail } = useRuntimeConfig().public
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-3xl font-semibold gradient-text tracking-tight">About</h1>
      <p class="text-night-400 mt-2">
        Goyangi — K-pop image &amp; video archive. Browse, like, and collect.
      </p>
    </div>

    <div class="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
      <!-- Left column -->
      <div class="flex-1 min-w-0 flex flex-col gap-6">
        <section class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-cat" class="text-pink-300" />
            <h2 class="micro-label text-pink-300">What is Goyangi?</h2>
          </div>
          <p class="text-night-300 leading-relaxed">
            Goyangi (고양이, Korean for cat) is a platform for sharing GIFs, pics, and other media
            related to K-pop girl groups. Its main purpose is archiving: everything is tagged and
            searchable, so content that would normally get lost in a scrolling feed stays easy to
            find later.
          </p>
          <p class="text-night-300 leading-relaxed">
            Content arrives in two ways — some is fetched automatically from selected Discord
            servers, the rest is uploaded directly on site. All of it is stored on Goyangi's own
            servers, and only administrators and moderators can remove it, so what gets archived
            stays archived. Think of it as a small stand-in for Gfycat and Imgur, focused purely on
            K-pop girl groups.
          </p>
          <p class="text-night-300 leading-relaxed">
            This is a passion project built by a single developer and still in early development.
            Alongside the site there is a Discord bot that handles automatic re-uploads, and a CLI
            tool for downloading and automation, both in active development.
          </p>

          <div class="border-t border-white/5 pt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div
              v-for="feature in [
                { icon: 'i-lucide-search', label: 'Search & tag filters' },
                { icon: 'i-lucide-folder-heart', label: 'Collections & likes' },
                { icon: 'i-lucide-tag', label: 'Shared labels' },
                { icon: 'i-lucide-star', label: 'Starred feed' },
                { icon: 'i-lucide-columns-2', label: 'Slideshow & splitscreen' },
                { icon: 'i-lucide-keyboard', label: 'Keyboard shortcuts' },
                { icon: 'i-lucide-wrench', label: 'Imgur recovery tools' },
                { icon: 'i-lucide-sticker', label: 'Stickers' },
              ]"
              :key="feature.label"
              class="flex items-center gap-2"
            >
              <UIcon :name="feature.icon" class="text-night-500 shrink-0" />
              <span class="text-sm text-night-200">{{ feature.label }}</span>
            </div>
          </div>
        </section>

        <section class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-hand-heart" class="text-pink-300" />
            <h2 class="micro-label text-pink-300">Support the project</h2>
          </div>
          <ul class="flex flex-col gap-2.5">
            <li class="flex items-start gap-2.5">
              <UIcon name="i-lucide-scroll-text" class="text-night-500 shrink-0 mt-0.5" />
              <span class="text-night-300">
                Make sure to read the
                <NuxtLink to="/terms" class="text-pink-400 hover:text-pink-300 transition-colors">
                  service terms</NuxtLink
                >.
              </span>
            </li>
            <li class="flex items-start gap-2.5">
              <UIcon name="i-lucide-bug" class="text-night-500 shrink-0 mt-0.5" />
              <span class="text-night-300">
                Spotted a bug or have a feature idea? Send a mail — every report helps.
              </span>
            </li>
            <li class="flex items-start gap-2.5">
              <UIcon name="i-lucide-piggy-bank" class="text-night-500 shrink-0 mt-0.5" />
              <span class="text-night-300">
                Want to chip in? Donations are not open yet — coming soon.
              </span>
            </li>
          </ul>
        </section>

        <section class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-mail" class="text-pink-300" />
            <h2 class="micro-label text-pink-300">Contact</h2>
          </div>
          <div class="text-night-300">
            <span class="font-medium text-night-100">Mail:</span>
            <a
              :href="`mailto:${supportEmail}`"
              class="text-pink-400 hover:text-pink-300 transition-colors ml-1"
              >{{ supportEmail }}</a
            >
          </div>
          <div class="text-night-300">
            <span class="font-medium text-night-100">Removal requests:</span>
            <NuxtLink
              to="/takedown"
              class="text-pink-400 hover:text-pink-300 transition-colors ml-1"
              >takedown page</NuxtLink
            >
          </div>
          <div class="text-night-300">
            <span class="font-medium text-night-100">Discord:</span>
            <a
              :href="discordInvite"
              target="_blank"
              rel="noopener noreferrer"
              class="text-violet-400 hover:text-violet-300 transition-colors ml-1"
              >join the server</a
            >
          </div>
        </section>
      </div>

      <!-- Right column -->
      <div class="flex-1 min-w-0 flex flex-col gap-6">
        <section class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-map" class="text-pink-300" />
            <h2 class="micro-label text-pink-300">Roadmap</h2>
          </div>

          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-night-100">Up next</h3>
            <ul class="flex flex-col gap-1.5">
              <li
                v-for="item in [
                  'Statistics page with aggregations of data',
                  'Ability to apply exclusive filters',
                ]"
                :key="item"
                class="flex items-start gap-2.5 text-night-300"
              >
                <UIcon name="i-lucide-circle-dashed" class="text-night-500 shrink-0 mt-0.5" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>

          <div class="flex flex-col gap-2 border-t border-white/5 pt-4">
            <h3 class="text-sm font-medium text-night-100">Recently shipped</h3>
            <ul class="flex flex-col gap-1.5">
              <li
                v-for="item in [
                  'Manage your posts from anywhere: edit, move between sets, delete',
                  'Select mode for doing the same thing to many posts or sets at once',
                  'Failed uploads show up with a Retry button',
                  'Sort by oldest, and by upload date or the content\'s own date',
                ]"
                :key="item"
                class="flex items-start gap-2.5 text-night-300"
              >
                <UIcon name="i-lucide-check" class="text-green-400 shrink-0 mt-0.5" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </section>

        <section class="glass-card p-6 flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-triangle-alert" class="text-amber-300" />
            <h2 class="micro-label text-amber-300">Known issues</h2>
          </div>
          <ul class="flex flex-col gap-1.5">
            <li
              v-for="issue in [
                {
                  icon: 'i-lucide-image',
                  text: 'Pictures uploaded before v1.2 keep their old quality — the source file is not stored after processing, so they cannot be re-rendered',
                },
                {
                  icon: 'i-lucide-film',
                  text: 'Older videos have no SD version, so the SD MP4 setting falls back to HD on them',
                },
                {
                  icon: 'i-lucide-tag',
                  text: 'A label can only be removed by whoever added it, or by an admin',
                },
                {
                  icon: 'i-lucide-puzzle',
                  text: 'Imagus browser extension inconsistently embeds content on site',
                },
              ]"
              :key="issue.text"
              class="flex items-start gap-2.5 text-night-300"
            >
              <UIcon :name="issue.icon" class="text-night-500 shrink-0 mt-0.5" />
              <span>{{ issue.text }}</span>
            </li>
          </ul>
        </section>

        <section class="glass-card p-6 flex flex-col gap-5">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-history" class="text-pink-300" />
            <h2 class="micro-label text-pink-300">Changelog</h2>
          </div>

          <div
            v-for="release in [
              {
                version: 'v1.4',
                date: 'October 9th 2026',
                groups: [
                  {
                    label: 'New',
                    items: [
                      'Edit, move to another set, remove from a set or delete your own posts from any right-click or long-press menu, and from buttons on the post page',
                      'Select mode: pick many posts or sets and edit, move, delete, collect, label or download them at once, across pages',
                      'Merge your own sets. Deleting a set you share with other uploaders removes only your posts',
                      'Uploads that fail processing show up in My uploads with a Retry button, and uploads interrupted by a restart pick up again on their own',
                      'Edit, delete or retry a file right from the upload results',
                      'Sort by Oldest, and sort or filter by the upload date or the content\'s own date',
                      'Download a whole set from any of its cards. Copy and Download are now submenus',
                      'Pinch, double-tap or ctrl+scroll to zoom pictures in fullscreen',
                      'The back button closes fullscreen instead of leaving the page',
                      'New posts since your last visit are marked on the home page',
                      'Share button on post and set pages, using your phone\'s share sheet',
                      'Videos on a post\'s page autoplay muted and loop',
                      'Edit or delete a collection from its own page',
                      'Turn off automatic import of your Discord posts in your profile, if you upload everything here',
                      'Keyboard shortcuts: / to search, F for fullscreen, C, D and A in fullscreen, ? for the full list',
                      'Admin page for reports, failed posts, empty sets and Discord import blocks',
                    ],
                  },
                  {
                    label: 'Fixed',
                    items: [
                      'Shorter, plainer wording across the whole site',
                      'Fullscreen arrows no longer jump around when the next item is a different size, and media keeps its space while loading',
                      'Posts and sets can only be changed by their own uploaders or admins',
                      'A content date is only shown when it differs from the upload date',
                      'The post editor offers every file type, including gifs and stickers',
                      'Copy buttons in list view hand over short links',
                      'The selection bar no longer covers the page navigation',
                    ],
                  },
                ],
              },
              {
                version: 'v1.3',
                date: 'August 9th 2026',
                groups: [
                  {
                    label: 'New',
                    items: [
                      'Rebuilt upload page — set every file\'s idols, tags, title and date individually, or let them inherit the batch',
                      'Upload straight into a collection instead of creating a set',
                      'The encode queue is now visible: see how many items are ahead of yours before committing a batch',
                      'Downloads and copy links are split into HD (AV1) and SD (H.264), so older iPhones and Macs get a file that plays',
                      'Download All offers both renditions on sets and collections',
                      'Like All and Download All on the collection page',
                      'Wider desktop grid — six columns at 1080p, real margins, and a cap on how tall one card can get',
                      'Step through a set with the ← and → keys while hovering it',
                      'Your search term is part of the link now, so a shared URL carries it',
                      'Bot: aliases are recognised, and a post with no ping is read from its text instead of being dropped',
                      'Bot: repeated posts about the same idol fold into one set, and bare follow-up messages join the set they follow',
                      '/reupload can add to an existing set',
                      'Admins can merge duplicate uploader profiles and block an uploader from Discord ingestion',
                      'Every new upload stores its pixel dimensions, and the whole archive was backfilled',
                    ],
                  },
                  {
                    label: 'Fixed',
                    items: [
                      'Clicking an idol chip filtered by the wrong idol when several idols share a name — there are three Chaewons',
                      'Sets with nothing in them no longer take up a slot on the home page',
                      'A set holding a single item now opens that item instead of a page with one card on it',
                      'The filter dialog\'s Reset now actually resets',
                      'Sorting sets or collections by Most Liked returned an error page; it switches to the per-item list instead',
                      'Filter dropdowns could load empty, and a listing page could hang on its spinner forever',
                      'The paginator swallowed clicks across the whole width of the page',
                      'Editing a clip while it was still encoding had the edit silently reverted',
                      'Uploading to a collection no longer announces it on Discord, and you can only add to collections you own',
                      'Imgur links with a slug are recognised again, and a finished encode is no longer discarded',
                      'Titles are built from the names that actually resolved, and the idol wins when the pinged group is wrong',
                      'The upload form could be submitted twice, and kept showing a validation error for an upload that had succeeded',
                      'Video uploads take their thumbnail from the SD rendition, so set previews are no longer blank',
                      'Removed the preview format and frame interpolation pickers — WebP is the default, and interpolation is not finished',
                    ],
                  },
                ],
              },
              {
                version: 'v1.2',
                date: 'July 31st 2026',
                groups: [
                  {
                    label: 'New',
                    items: [
                      'Labels — loose, shared tags anyone can create, add from the right-click menu, and filter by',
                      'My Feed — star the idols and groups you follow and get a feed of only them',
                      'Like a whole set at once, from the menu or by holding the like button',
                      'Rebuilt content page, with fullscreen and every card action on it',
                      'My Sets page, list views, and multi-select with copy-links',
                      'View counts on content and set pages',
                      'Edit a whole set\'s details at once, and choose which changes reach its contents',
                      'Filter by direct vs Discord uploads',
                      'Create an empty collection without picking content first',
                      'Set cards show dots, so it\'s clear there is more than one item inside',
                      'New bot commands: /show, which lets each person pick their own format, and /reupload',
                      'Add ?sd to any content link for an embed that plays on older iPhones',
                      'Embeds now show the item\'s real title',
                    ],
                  },
                  {
                    label: 'Fixed',
                    items: [
                      'Pictures are much sharper — portrait images were being downscaled to roughly half their resolution (new uploads only)',
                      'Deleting content now removes its files from storage too',
                      'The Direct tag no longer shows on content that came from Discord',
                      'Sets page returned nothing when filtered by tag or content type',
                      'Searching with a quote character froze the page',
                      'Set previews were blank when adding uploads to an existing set',
                      'Right-click menu stayed put when opened somewhere else',
                      'Liking two things quickly could silently fail',
                      'On the bot, one unrecognised tag no longer discards the whole post',
                    ],
                  },
                ],
              },
              {
                version: 'v1.0',
                date: 'July 12th 2026',
                groups: [
                  {
                    label: '',
                    items: [
                      'Added ability to middle click/open new tab entire set',
                      'Registration using email and password instead of Discord OAuth',
                      'Filters being applied despite empty search bar bug fixed',
                      'No filters are applied in single set view',
                      'More consistent column layout that respects left to right created order',
                    ],
                  },
                ],
              },
              {
                version: 'v0.51',
                date: 'Jan 4th 2025',
                groups: [
                  {
                    label: '',
                    items: [
                      'Added quick access to top posts for predefined periods',
                      'Change button icon depending on slideout state',
                      'Center content on screen on click',
                    ],
                  },
                ],
              },
            ]"
            :key="release.version"
            class="flex flex-col gap-3"
          >
            <div class="flex items-baseline gap-2">
              <span class="font-mono text-sm font-semibold text-pink-300">{{
                release.version
              }}</span>
              <span class="text-xs text-night-500">{{ release.date }}</span>
            </div>
            <!-- Grouped so a large release reads as New / Fixed rather than one
                 undifferentiated wall. Older entries carry a single unlabelled
                 group: same shape, so no heading is invented for them and the
                 array stays one type rather than a union vue-tsc has to narrow. -->
            <div v-for="group in release.groups" :key="group.label" class="flex flex-col gap-1">
              <h3 v-if="group.label" class="micro-label text-night-500">{{ group.label }}</h3>
              <ul
                class="list-disc list-inside marker:text-night-600 text-night-300 flex flex-col gap-1"
              >
                <li v-for="change in group.items" :key="change">{{ change }}</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
