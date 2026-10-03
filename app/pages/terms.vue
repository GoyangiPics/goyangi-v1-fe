<script setup lang="ts">
// Static page; only the contact route comes from config so it lives in one
// place (see nuxt.config.ts runtimeConfig.public).
useHead({ title: 'Terms of Service' })

const { supportEmail } = useRuntimeConfig().public
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-8 text-gray-200">
    <!-- Header -->
    <div class="border-b border-gray-700 pb-6 mb-8">
      <h1 class="text-3xl font-bold text-white">Terms &amp; Conditions</h1>
      <p class="text-gray-400 mt-1">
        Goyangi - K-pop image and video archive - browse, like, and collect.
      </p>
      <div class="flex gap-3 text-sm text-gray-500 mt-2">
        <span>Version 1.1</span>
        <span>•</span>
        <span>Last Updated: September 1st 2026</span>
      </div>
    </div>

    <!-- Section 1 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">1. Acceptance</h2>
      <p class="text-gray-300 leading-relaxed">
        By accessing or using <span class="text-gray-200 font-medium">goyangi.pics</span> (the
        "Website"), you agree to be bound by these Terms &amp; Conditions and our
        <NuxtLink to="/privacy" class="text-gray-200 font-medium hover:underline"
          >Privacy Policy</NuxtLink
        >. This Agreement applies to all visitors and members. We reserve the right to modify these
        terms at any time. Your continued use of the Website following any changes constitutes
        acceptance of those modifications. If you do not agree to these terms, please discontinue
        use of the Website immediately.
      </p>
    </section>

    <!-- Section 2 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">2. Description &amp; Purpose</h2>
      <p class="text-gray-300 leading-relaxed">
        <span class="text-gray-200 font-medium">goyangi.pics</span> provides a platform for fans to
        share and view K-Pop related media content, including GIFs, images, and short video clips
        derived from publicly available sources such as official music videos, live performances,
        variety show appearances, and fancams.
      </p>
      <div class="border-l-4 border-blue-500 pl-4 my-3">
        <p class="text-gray-300 text-sm">
          <strong class="text-gray-200">Important:</strong> While we require users to be
          <strong class="text-gray-200">18 years of age or older</strong>, all content on our
          platform is strictly <strong class="text-gray-200">SFW (Safe For Work)</strong> and
          contains
          <strong class="text-gray-200"
            >no nudity, no pornography, and no sexually explicit material</strong
          >.
        </p>
      </div>
      <div class="border-l-4 border-purple-500 pl-4 my-3">
        <p class="text-gray-300 text-sm">
          <strong class="text-gray-200">Our Mission:</strong> To create a positive, fan-focused
          community celebrating K-Pop artistry through high-quality visual content.
        </p>
      </div>
      <p class="text-gray-300 leading-relaxed mt-2">
        The Website is for your personal, non-commercial use only. Any unauthorized commercial use
        or automated data collection (like scraping) is strictly prohibited. The Website may contain
        links to third-party sites. We do not own, control, or assume any responsibility for the
        content or practices of these external websites. You access them at your own risk.
      </p>
    </section>

    <!-- Section 3 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">3. Access &amp; Age Requirement</h2>
      <p class="text-gray-300 leading-relaxed">
        You must be at least <strong class="text-gray-200">18 years of age</strong> (or the legal
        age of majority in your jurisdiction, whichever is higher) to use the Website. By accessing
        <span class="text-gray-200 font-medium">goyangi</span>, you confirm that you are an adult
        and that you agree to participate in our community with maturity, respect, and in accordance
        with our ethical guidelines.
      </p>
      <ul class="mt-2 text-sm text-gray-400 list-disc list-inside space-y-1">
        <li>Global standard: <strong class="text-gray-200">18+</strong> international age</li>
        <li>South Korea: <strong class="text-gray-200">19+</strong> (Year Age system)</li>
      </ul>
      <p class="text-sm text-gray-400 mt-2 bg-gray-800/50 p-3 rounded border border-gray-700">
        <strong class="text-gray-200">Note:</strong> While we require users to be 18+, all content
        is SFW and contains no nudity or pornography.
      </p>
    </section>

    <!-- Section 4 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">4. Content Policy – Zero Tolerance</h2>
      <p class="text-gray-300 leading-relaxed">
        The Website maintains a <strong class="text-red-400">Zero Tolerance policy</strong> toward
        prohibited content. Any material falling into these categories will be removed immediately,
        and accounts terminated:
      </p>
      <ul class="mt-2 text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>Deepfakes &amp; AI-manipulated or deceptive content</li>
        <li>Sexually explicit content, nudity, or pornography</li>
        <li>Non-consensual or private/leaked content</li>
        <li>Harassment, defamation, or hate speech</li>
        <li>Illegal content or content promoting illegal acts</li>
        <li>Copyright-infringing material</li>
        <li>Content depicting violence, injury, or cruelty</li>
        <li>Wardrobe malfunctions, slips, or incidental exposure</li>
        <li>
          <strong class="text-red-400">Pre-debut content</strong> — any material recorded or
          published before an idol's official debut, i.e. before they became a public figure. This
          includes school photos, personal social media from before debut, trainee-era footage that
          was not officially released, and any other private material from that period.
        </li>
      </ul>
    </section>

    <!-- Section 5 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">5. Permitted Content Standards</h2>
      <p class="text-gray-300 leading-relaxed">
        The following types of uploads are <strong class="text-green-400">permitted</strong>:
      </p>
      <ul class="mt-2 text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>Still images and short clips from publicly available performances and broadcasts</li>
        <li>Slow motion or speed-adjusted clips</li>
        <li>GIFs and animated highlights from music videos, variety shows, or live stages</li>
        <li>Creative fan edits such as color grading, text overlays, or artistic filters</li>
        <li>Content celebrating choreography, fashion, expressions, and performance artistry</li>
      </ul>
      <p class="mt-3 text-gray-300 leading-relaxed text-sm">
        In every case the material must date from
        <strong class="text-white">after the idol's official debut</strong>. Pre-debut material is
        prohibited outright — see section 4.
      </p>
    </section>

    <!-- Section 6 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">6. Ethical Guidelines</h2>
      <ul class="text-gray-300 list-disc list-inside space-y-1 text-sm">
        <li>
          <strong class="text-gray-200">Artist Respect:</strong> Celebrate artistry and talent.
        </li>
        <li>
          <strong class="text-gray-200">Community Focus:</strong> Foster positive, supportive
          interactions.
        </li>
        <li>
          <strong class="text-gray-200">Dignity First:</strong> Maintain respect for all individuals
          depicted.
        </li>
        <li>
          <strong class="text-gray-200">Constructive Fandom:</strong> Enhance enjoyment through
          creative, positive content.
        </li>
      </ul>
    </section>

    <!-- Section 7-8 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">7. Conduct</h2>
        <p class="text-gray-300 leading-relaxed text-sm">
          You are responsible for your user submissions. You agree not to post illegal, harassing,
          defamatory, or obscene content; not to distribute viruses or malicious code; not to
          violate any laws; not to impersonate others; and not to engage in disruptive behavior.
        </p>
      </section>
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">8. Intellectual Property</h2>
        <p class="text-gray-300 leading-relaxed text-sm">
          Website content is owned by or licensed to us. You may not copy, distribute, or
          commercially exploit content without permission. User submissions retain your ownership,
          but you grant us a limited license to display and promote them on our platform.
        </p>
      </section>
    </div>

    <!-- Section 9 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">9. User Submissions</h2>
      <p class="text-gray-300 leading-relaxed text-sm">
        You retain all ownership rights in your User Submissions. By submitting content, you grant
        us a
        <strong class="text-gray-200">non-exclusive, royalty-free, worldwide license</strong> to
        use, reproduce, distribute, display, and perform your submissions in connection with the
        Website.
      </p>
      <ul class="mt-2 text-gray-400 text-sm list-disc list-inside space-y-1">
        <li>
          We do <strong class="text-gray-200">not</strong> sublicense your content to third parties
        </li>
        <li>
          We do <strong class="text-gray-200">not</strong> create derivative works without consent
        </li>
        <li>This license terminates when you delete your submission</li>
        <li>We do <strong class="text-gray-200">not</strong> claim ownership of your content</li>
      </ul>
    </section>

    <!-- Section 10 -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-white mb-2">10. Fair Use &amp; Copyright Compliance</h2>
      <p class="text-gray-300 leading-relaxed text-sm">
        We recognize that many User Submissions may qualify as
        <strong class="text-gray-200">fair use</strong> under applicable copyright law. We respond
        to valid DMCA takedown notices — see the
        <NuxtLink to="/takedown" class="text-gray-200 font-medium hover:underline"
          >takedown page</NuxtLink
        >
        for how to submit one.
      </p>
    </section>

    <!-- Section 11-12 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">11. Reporting</h2>
        <p class="text-gray-300 text-sm">
          Report violations at
          <a :href="`mailto:${supportEmail}`" class="text-gray-200 font-medium hover:underline">{{
            supportEmail
          }}</a>
          or through the
          <NuxtLink to="/takedown" class="text-gray-200 font-medium hover:underline"
            >takedown page</NuxtLink
          >. We review promptly and take appropriate action.
        </p>
      </section>
      <section>
        <h2 class="text-xl font-semibold text-white mb-2">12. Account Termination</h2>
        <p class="text-gray-300 text-sm">
          We may terminate accounts for copyright infringement, prohibited content, harassment,
          privacy violations, or repeated policy violations. Termination may occur without prior
          notice.
        </p>
      </section>
    </div>

    <!-- Sections 13-15 -->
    <section class="mb-8 border-t border-gray-700 pt-6">
      <h2 class="text-xl font-semibold text-white mb-3">13. Warranty Disclaimer</h2>
      <p class="text-gray-300 text-sm leading-relaxed">
        The Website is provided <strong class="text-gray-200">"AS IS"</strong> and
        <strong class="text-gray-200">"AS AVAILABLE."</strong> We disclaim all warranties and do not
        guarantee error-free, secure, or uninterrupted service.
      </p>

      <h2 class="text-xl font-semibold text-white mt-4 mb-2">14. Limitation of Liability</h2>
      <p class="text-gray-300 text-sm leading-relaxed">
        We are not liable for any direct, indirect, incidental, or consequential damages arising
        from your use of the Website.
      </p>

      <h2 class="text-xl font-semibold text-white mt-4 mb-2">15. Indemnity</h2>
      <p class="text-gray-300 text-sm leading-relaxed">
        You agree to defend and indemnify us against any claims arising from your use of the Website
        or violation of these Terms.
      </p>
    </section>

    <!-- Sections 16-23 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-sm">
      <div>
        <p class="font-semibold text-white">16. Third-Party Links</p>
        <p class="text-gray-400">
          We assume no responsibility for external websites linked from our platform.
        </p>
      </div>
      <div>
        <p class="font-semibold text-white">17. Governing Law</p>
        <p class="text-gray-400">These Terms are governed by applicable law.</p>
      </div>
      <div>
        <p class="font-semibold text-white">18. Changes to Terms</p>
        <p class="text-gray-400">
          We may modify these Terms with 30 days notice for material changes.
        </p>
      </div>
      <div>
        <p class="font-semibold text-white">19-23. Miscellaneous</p>
        <p class="text-gray-400">
          Severability, waiver, assignment, entire agreement, and contact provisions apply.
        </p>
      </div>
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
            <td class="py-2 pr-4 font-medium text-gray-300">Age Requirement</td>
            <td class="py-2 text-gray-400">18+ (19+ in South Korea)</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Content Type</td>
            <td class="py-2 text-gray-400">SFW K-Pop media (GIFs, images, clips)</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Nudity / Pornography</td>
            <td class="py-2 text-red-400 font-medium">Strictly prohibited</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Deepfakes / Deceptive Edits</td>
            <td class="py-2 text-red-400 font-medium">Strictly prohibited</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Malfunctions / Slips</td>
            <td class="py-2 text-red-400 font-medium">Strictly prohibited</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Ownership</td>
            <td class="py-2 text-gray-400">You retain rights; limited license to us</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Sublicensing</td>
            <td class="py-2 text-gray-400">Not permitted</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Termination</td>
            <td class="py-2 text-gray-400">At our discretion, without notice</td>
          </tr>
          <tr>
            <td class="py-2 pr-4 font-medium text-gray-300">Fair Use</td>
            <td class="py-2 text-gray-400">Recognized and respected</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Footer -->
    <div class="border-t border-gray-700 mt-8 pt-6 text-center text-xs text-gray-500">
      <p>
        Questions about these Terms? Email
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
