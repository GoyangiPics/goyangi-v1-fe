<script setup lang="ts">
// Static page like /terms; only the contact routes come from config so a
// staging deploy can point elsewhere (see nuxt.config.ts runtimeConfig.public).
useHead({ title: 'Privacy Policy' })

const { discordInvite, supportEmail } = useRuntimeConfig().public
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8 text-gray-200">
    <!-- Header -->
    <div class="border-b border-gray-700 pb-6 mb-8">
      <h1 class="text-3xl font-bold text-white">Privacy Policy</h1>
      <p class="text-gray-400 mt-1">
        Goyangi - K-pop image and video archive - browse, like, and collect.
      </p>
      <div class="flex gap-3 text-sm text-gray-500 mt-2">
        <span>Version 1.0</span>
        <span>•</span>
        <span>Last Updated: September 1st 2026</span>
      </div>
    </div>

    <!-- Section 1 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">1. Who We Are</h2>
      <p class="text-gray-300 leading-relaxed">
        <span class="text-gray-200 font-medium">goyangi.pics</span> (the "Website") is a
        non-commercial fan archive operated by a private individual under the name
        <span class="text-gray-200 font-medium">Goyangi</span> (the "operator", "we"). We are the
        data controller for the personal data described in this policy. There is no company behind
        the Website and no data protection officer is appointed — for anything related to your data,
        contact us directly:
      </p>
      <ul class="mt-2 text-sm text-gray-300 list-disc list-inside space-y-1">
        <li>
          Email:
          <a :href="`mailto:${supportEmail}`" class="text-gray-200 font-medium hover:underline">{{
            supportEmail
          }}</a>
        </li>
        <li>
          Discord:
          <a
            :href="discordInvite"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-200 font-medium hover:underline"
            >our server</a
          >
        </li>
      </ul>
    </section>

    <!-- Section 2 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">2. What We Collect, Feature by Feature</h2>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">Account</h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        When you register we store your <strong class="text-gray-200">email address</strong>, a
        <strong class="text-gray-200">hashed password</strong> (never the password itself), and an
        optional <strong class="text-gray-200">avatar image</strong> you upload. Your email is never
        shown publicly.
      </p>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">Signing in with Discord</h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        If you sign in through a third-party provider (currently Discord), we receive and store your
        provider
        <strong class="text-gray-200">account ID, username, avatar and email address</strong>
        as a linked sign-in method. Using a provider button when you have no account yet
        <strong class="text-gray-200">creates an account</strong> with that data. The provider's own
        privacy policy governs what the provider does on its side.
      </p>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">Uploader profile</h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        If you upload content, you choose an
        <strong class="text-gray-200">uploader display name</strong>. That name (and any known
        aliases for it) is <strong class="text-gray-200">shown publicly</strong> on every piece of
        content credited to it, on uploader pages, and in link previews of content pages.
      </p>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">Activity on the Website</h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        We store your
        <strong class="text-gray-200"
          >likes, starred idols/groups, saved filters, labels you apply, collections, and
          reports</strong
        >
        you submit. These are tied to your account. Entries you add with the links tool are
        <strong class="text-gray-200">publicly listable</strong>. Reports are visible only to you
        and to administrators.
      </p>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">Uploads</h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        Media you upload, together with its metadata (idols, groups, tags, title, date, source
        link), is <strong class="text-gray-200">public by design</strong> — that is the purpose of
        the Website.
      </p>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">
        Discord bot ingestion (also affects non-members)
      </h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        Our Discord bot archives media posted in
        <strong class="text-gray-200">specific, admin-approved channels</strong> of our Discord
        server. For each archived post we store: the
        <strong class="text-gray-200">media files</strong>, the poster's
        <strong class="text-gray-200">Discord username as public credit</strong>, and a
        <strong class="text-gray-200">link to the original Discord message</strong>. The text of a
        message is only read to extract idol/group/tag information and is
        <strong class="text-gray-200">not stored</strong>; the poster's Discord account ID is held
        briefly in server memory to group related posts and is not stored either. This applies to
        people who post in those channels even if they never registered on the Website — see section
        9.
      </p>

      <h3 class="text-base font-semibold text-gray-200 mt-4 mb-1">Technical data</h3>
      <p class="text-gray-300 leading-relaxed text-sm">
        Our server keeps short-lived <strong class="text-gray-200">request logs</strong> (which may
        include your IP address) for security and abuse prevention, and
        <strong class="text-gray-200">operational error logs</strong> for keeping the service
        running. View counts on content are
        <strong class="text-gray-200">anonymous counters</strong> — no record of who viewed what is
        kept. There are <strong class="text-gray-200">no analytics, no ads, and no tracking</strong>
        on the Website.
      </p>
    </section>

    <!-- Section 3 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">3. Cookies &amp; Browser Storage</h2>
      <p class="text-gray-300 leading-relaxed">
        The Website sets <strong class="text-gray-200">no cookies</strong>. It uses your browser's
        <strong class="text-gray-200">localStorage</strong> for things the site cannot work without
        or that only affect your own browser: your login session token (including a copy of your own
        account record) and your UI preferences (layout, filters, settings). Nothing in this storage
        is used for tracking or shared with anyone, which is why no consent banner is shown. It is
        removed when you log out or clear your browser data.
      </p>
    </section>

    <!-- Section 4 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">
        4. Why We May Process Your Data (Legal Bases)
      </h2>
      <ul class="text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          <strong class="text-gray-200">Contract (Art. 6(1)(b) GDPR)</strong> — everything needed to
          provide your account and the features you use: registration, uploads, likes, collections,
          filters.
        </li>
        <li>
          <strong class="text-gray-200">Legitimate interests (Art. 6(1)(f) GDPR)</strong> —
          crediting archived Discord posts to their poster, keeping security and error logs, and
          preventing abuse. Our interest is running an accurate, attributable fan archive and
          keeping it safe; you can object at any time (section 8).
        </li>
      </ul>
      <p class="text-gray-300 leading-relaxed text-sm mt-2">
        We do not process any special categories of personal data and we never sell data.
      </p>
    </section>

    <!-- Section 5 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">5. Who Receives Your Data</h2>
      <ul class="text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          <strong class="text-gray-200">Cloudflare</strong> — proxies all traffic to the Website and
          its API (CDN, DDoS protection), processing IP addresses and request metadata at its edge,
          and stores all media files (R2 object storage) — under Cloudflare's standard data
          processing addendum. From this we see only aggregate traffic statistics; Cloudflare sets
          no cookies here and no analytics script runs in your browser.
        </li>
        <li>
          <!-- TODO(operator): confirm hosting provider + region and name it here if third-party. -->
          <strong class="text-gray-200">Server hosting</strong> — the Website and its database run
          on our own server infrastructure in the European Union.
        </li>
        <li>
          <strong class="text-gray-200">Discord</strong> — an independent service: the bot operates
          inside Discord, and Discord sign-in exchanges data with Discord.
        </li>
        <li>
          <strong class="text-gray-200">Proton (email)</strong> — support and data-request emails
          arrive in a Proton Mail mailbox.
        </li>
        <li>
          <strong class="text-gray-200">Imgur</strong> — only if you use the imgur import tool: your
          browser fetches the files <strong class="text-gray-200">directly from imgur</strong>, so
          imgur sees your IP address and browser details, governed by imgur's own privacy policy.
        </li>
      </ul>
      <p class="text-gray-300 leading-relaxed text-sm mt-2">
        Nobody else receives personal data. No data brokers, no ad networks, no analytics vendors.
      </p>
    </section>

    <!-- Section 6 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">6. International Transfers</h2>
      <p class="text-gray-300 leading-relaxed text-sm">
        Media storage uses Cloudflare R2 configured for a
        <strong class="text-gray-200">European region</strong>; where any Cloudflare processing
        touches other regions it is covered by Cloudflare's data processing addendum and standard
        contractual clauses. Discord is a US company — data you share on Discord is governed by
        Discord's own privacy policy and transfer safeguards.
      </p>
    </section>

    <!-- Section 7 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">7. How Long We Keep Things</h2>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-gray-700">
            <th class="text-left py-2 pr-4 font-semibold text-gray-300">Data</th>
            <th class="text-left py-2 font-semibold text-gray-300">Kept for</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Account data</td>
            <td class="py-2 text-gray-400">Until you delete your account</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Uploaded / archived content</td>
            <td class="py-2 text-gray-400">
              Until removed; when an account is deleted the content stays but its credit is
              anonymized (section 8)
            </td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Operational error logs</td>
            <td class="py-2 text-gray-400">90 days</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Request logs (may include IP)</td>
            <td class="py-2 text-gray-400">At most 7 days</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Support &amp; data-request emails</td>
            <td class="py-2 text-gray-400">For the duration of the matter</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Backups</td>
            <td class="py-2 text-gray-400">
              Short rolling window; deleted data ages out of backups automatically
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Section 8 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">8. Your Rights</h2>
      <p class="text-gray-300 leading-relaxed text-sm">
        Under the GDPR you can ask for
        <strong class="text-gray-200">access</strong> to your data,
        <strong class="text-gray-200">rectification</strong>,
        <strong class="text-gray-200">erasure</strong>,
        <strong class="text-gray-200">restriction</strong> of processing,
        <strong class="text-gray-200">portability</strong>, and you can
        <strong class="text-gray-200">object</strong> to processing based on legitimate interests.
        In practice:
      </p>
      <ul class="mt-2 text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          <strong class="text-gray-200">Export</strong> — use the "Download my data" button on your
          profile page for a copy of your account data in JSON.
        </li>
        <li>
          <strong class="text-gray-200">Delete your account</strong> — self-service on your profile
          page. This permanently removes your account, email, likes, stars, filters and saved links.
          <strong class="text-gray-200">Content you uploaded stays on the Website</strong>, credited
          to an anonymized uploader name; if you want specific content removed as well, email us.
        </li>
        <li>
          <strong class="text-gray-200">Everything else</strong> — email
          <a :href="`mailto:${supportEmail}`" class="text-gray-200 font-medium hover:underline">{{
            supportEmail
          }}</a
          >. We respond within one month.
        </li>
      </ul>
      <p class="text-gray-300 leading-relaxed text-sm mt-2">
        You also have the right to complain to a data protection supervisory authority. In the
        EU/EEA you can lodge that complaint with the authority of the country where you live, where
        you work, or where you believe the issue happened — it does not have to be ours.
      </p>
    </section>

    <!-- Section 9 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">
        9. If You Post on Discord but Have No Account Here
      </h2>
      <p class="text-gray-300 leading-relaxed text-sm">
        Media you post in the bot-watched channels of our Discord server may be archived here and
        publicly credited to your Discord username, as described in section 2. Those channels carry
        a pinned notice saying so. If you don't want this:
      </p>
      <ul class="mt-2 text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          run the bot's <span class="text-gray-200 font-medium">/privacy</span> command on Discord
          for the short version of this policy and the opt-out contact,
        </li>
        <li>
          email
          <a :href="`mailto:${supportEmail}`" class="text-gray-200 font-medium hover:underline">{{
            supportEmail
          }}</a>
          to opt out of future archiving, to have your username removed from existing credits, or to
          have content taken down — see also our
          <NuxtLink to="/takedown" class="text-gray-200 font-medium hover:underline"
            >takedown page</NuxtLink
          >.
        </li>
      </ul>
    </section>

    <!-- Sections 10-13 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">10. No Profiling</h2>
        <p class="text-gray-300 text-sm leading-relaxed">
          We make no automated decisions about you and build no profiles. Data is never used to
          train AI or machine-learning models.
        </p>
      </section>
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">11. Age Requirement</h2>
        <p class="text-gray-300 text-sm leading-relaxed">
          The Website is for adults — 18+ (19+ in South Korea), as set out in the
          <NuxtLink to="/terms" class="text-gray-200 font-medium hover:underline">Terms</NuxtLink>.
          We do not knowingly process children's data.
        </p>
      </section>
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">12. Security</h2>
        <p class="text-gray-300 text-sm leading-relaxed">
          All traffic is encrypted in transit (HTTPS), passwords are stored only as hashes, stored
          data is encrypted at rest, and administrative access is limited to the operator. If a
          breach ever puts your data at risk, we will notify the supervisory authority and affected
          users as the GDPR requires.
        </p>
      </section>
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">13. Changes to This Policy</h2>
        <p class="text-gray-300 text-sm leading-relaxed">
          When this policy changes, the version and date at the top change with it. Material changes
          are announced on the Website and in our Discord server.
        </p>
      </section>
    </div>

    <!-- Quick Reference Table -->
    <section class="border-t border-gray-700 pt-6">
      <h2 class="text-xl font-semibold text-white mb-3">Quick Reference</h2>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-gray-700">
            <th class="text-left py-2 pr-4 font-semibold text-gray-300">Aspect</th>
            <th class="text-left py-2 font-semibold text-gray-300">Policy</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Controller</td>
            <td class="py-2 text-gray-400">Goyangi (private individual)</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Analytics / Ads / Tracking</td>
            <td class="py-2 text-green-400 font-medium">None</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Cookies</td>
            <td class="py-2 text-gray-400">None — localStorage for login &amp; preferences only</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Selling data</td>
            <td class="py-2 text-red-400 font-medium">Never</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Public data</td>
            <td class="py-2 text-gray-400">Uploader name, uploads &amp; their metadata</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Account deletion</td>
            <td class="py-2 text-gray-400">Self-service on your profile page</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Data export</td>
            <td class="py-2 text-gray-400">Self-service JSON download on your profile page</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Requests answered within</td>
            <td class="py-2 text-gray-400">One month</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Complaints</td>
            <td class="py-2 text-gray-400">Your local EU/EEA data protection authority</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Footer -->
    <div class="border-t border-gray-700 mt-8 pt-6 text-center text-xs text-gray-500">
      <p>
        Questions about this policy? Email
        <a :href="`mailto:${supportEmail}`" class="text-gray-400 font-medium hover:underline">{{
          supportEmail
        }}</a
        >.
      </p>
      <p class="mt-1">
        <span class="text-gray-400 font-medium">goyangi.pics</span> — K-Pop Media Gallery
      </p>
    </div>
  </div>
</template>
