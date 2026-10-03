<script setup lang="ts">
// Static page like /terms; the contact route comes from config (see
// nuxt.config.ts runtimeConfig.public).
useHead({ title: 'Takedown' })

const { supportEmail } = useRuntimeConfig().public

const mailtoHref = `mailto:${supportEmail}?subject=${encodeURIComponent('[Takedown] <link to the content>')}`
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8 text-gray-200">
    <!-- Header -->
    <div class="border-b border-gray-700 pb-6 mb-8">
      <h1 class="text-3xl font-bold text-white">Takedown &amp; Content Reports</h1>
      <p class="text-gray-400 mt-1">
        How to report content on goyangi.pics and ask for its removal.
      </p>
      <div class="flex gap-3 text-sm text-gray-500 mt-2">
        <span>Version 1.0</span>
        <span>•</span>
        <span>Last Updated: September 1st 2026</span>
      </div>
    </div>

    <!-- Section 1 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">1. What You Can Report Here</h2>
      <ul class="text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          <strong class="text-gray-200">Copyright infringement</strong> — you own or represent the
          rights to a work hosted here (DMCA and equivalent notices).
        </li>
        <li>
          <strong class="text-gray-200">Image / personality rights</strong> — you are (or represent)
          a person depicted and want the material removed.
        </li>
        <li>
          <strong class="text-gray-200">Personal data removal (GDPR)</strong> — your name or other
          personal data appears here and you want it erased. This is also the route for
          <strong class="text-gray-200">Discord posters without an account</strong> who want their
          username removed from credits or their posts un-archived, including opting out of future
          archiving.
        </li>
        <li>
          <strong class="text-gray-200">Zero-tolerance content</strong> — anything listed in
          <NuxtLink to="/terms" class="text-gray-200 font-medium hover:underline"
            >section 4 of the Terms</NuxtLink
          >
          (deepfakes, explicit or leaked material, pre-debut content, and so on).
        </li>
        <li>
          <strong class="text-gray-200">Any other illegal content</strong> — this page is our
          notice-and-action mechanism under Art. 16 of the EU Digital Services Act.
        </li>
      </ul>
      <p class="text-gray-300 leading-relaxed text-sm mt-3">
        <strong class="text-gray-200">Members:</strong> for ordinary policy violations the fastest
        route is the <strong class="text-gray-200">Report</strong> option on the content itself
        (right-click menu or the content page). Use email for legal notices, anything requiring
        follow-up, or if you have no account.
      </p>
    </section>

    <!-- Section 2 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">2. How to Send a Notice</h2>
      <p class="text-gray-300 leading-relaxed text-sm">
        Email
        <a :href="mailtoHref" class="text-gray-200 font-medium hover:underline">{{
          supportEmail
        }}</a>
        with a subject starting with <span class="text-gray-200 font-medium">[Takedown]</span>. So
        we can act on the notice, include:
      </p>
      <ul class="mt-2 text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          The <strong class="text-gray-200">exact goyangi.pics link(s)</strong> to the content
          (single, set or collection URLs).
        </li>
        <li>
          <strong class="text-gray-200">Which category</strong> from section 1 applies, and a short
          explanation of why the content should be removed.
        </li>
        <li>
          For <strong class="text-gray-200">copyright</strong>: identification of the original work,
          confirmation that you are the rights holder or act for them, and a statement that your
          notice is made in good faith and is accurate.
        </li>
        <li>
          For <strong class="text-gray-200">image rights / personal data</strong>: who you are, what
          in the content identifies you (or the person you represent), and the outcome you want —
          removal, anonymized credit, or opt-out from future archiving.
        </li>
        <li>An <strong class="text-gray-200">email address</strong> we can reply to.</li>
      </ul>
    </section>

    <!-- Section 3 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">3. What Happens Next</h2>
      <ul class="text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          We confirm receipt of a complete notice, normally within
          <strong class="text-gray-200">7 days</strong>.
        </li>
        <li>
          We review and decide without undue delay — normally within
          <strong class="text-gray-200">14 days</strong>; clearly illegal or zero-tolerance content
          is removed as soon as we see it.
        </li>
        <li>
          Personal-data erasure requests are completed within
          <strong class="text-gray-200">one month</strong>, as the GDPR requires.
        </li>
        <li>
          We tell you the outcome and the reason. If content you uploaded is removed, we tell you
          why, and you can reply with a counter-notice if you believe the removal was mistaken.
        </li>
        <li>
          The Website is run by one person — every notice is read and handled by a human, not an
          automated system.
        </li>
      </ul>
      <p class="text-gray-300 leading-relaxed text-sm mt-3">
        Knowingly false notices waste the time that handles real ones and may be ignored after a
        warning. Repeat copyright infringers have their accounts terminated, as set out in
        <NuxtLink to="/terms" class="text-gray-200 font-medium hover:underline"
          >section 12 of the Terms</NuxtLink
        >.
      </p>
    </section>

    <!-- Footer -->
    <div class="border-t border-gray-700 mt-8 pt-6 text-center text-xs text-gray-500">
      <p>
        This page is the Website's point of contact for users and authorities under Arts. 11–12 of
        the EU Digital Services Act. Notices are accepted in English.
      </p>
      <p class="mt-1">
        <span class="text-gray-400 font-medium">goyangi.pics</span> — K-Pop Media Gallery
      </p>
    </div>
  </div>
</template>
