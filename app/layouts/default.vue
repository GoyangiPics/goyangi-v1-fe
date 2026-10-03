<script setup lang="ts">
const settingsStore = useSettingsStore()
</script>

<template>
  <!-- 160rem = 2560px. Was 105rem (1680px), which left 440px of dead margin per
       side on a 1440p screen and 880px on an ultrawide — the grid columns stretch
       to fill, so that width was going into empty space instead of into the
       cards. Still capped rather than fluid: past ~2560px a single row spans more
       than an arm's width and reading it becomes neck work.

       The horizontal padding grows with the viewport because the opposite problem
       showed up once the cap was raised: on a 24" 1080p monitor the grid ran
       essentially edge to edge, which reads as stretched however well the columns
       fit. 96px either side (plus main's 16) frames it without eating enough width
       to cost a column — see gridChromeAt in ~/utils/responsiveColumns, which
       encodes these same numbers for the column ladder and is where they're
       tested. Change one and change the other. -->
  <div class="min-h-dvh max-w-[160rem] mx-auto flex flex-col p-6 xl:px-12 2xl:px-24 mb-20">
    <Header />
    <!-- px-4 is the only inset here, and it is what gridChromeAt counts as the
         inner half of the chrome. Everything in main — the bars above the grid and
         the grid itself — therefore shares one width. An earlier attempt held the
         bars narrower than the grid; it read worse than having them line up. -->
    <main class="mx-auto w-full px-4 pb-8">
      <slot />
    </main>
    <DialogBaseSettings
      :is-visible="settingsStore.isSettingsOpen"
      @update:is-visible="settingsStore.isSettingsOpen = $event"
    />
  </div>
</template>
