<script setup lang="ts">
import type { Idol } from '~/types/appTypes'
import { computed, onMounted, ref } from 'vue'
import { ageTurning, isBirthdayOn, localDateKey } from '~/utils/birthdays'
import { idolQueryToken } from '~/utils/idolSelection'

/**
 * One announcement per idol whose birthday is today, each linking to that
 * idol's posts on the home grid.
 *
 * Client-only (the layout wraps it): "today" is the visitor's own calendar day
 * and dismissals live in their browser, neither of which the server knows —
 * rendering it there would only mismatch on hydration.
 */
const referenceStore = useReferenceStore()

const DISMISSED_KEY = 'goyangi:birthdaysDismissed'

// Read once on mount. A tab left open past midnight keeps yesterday's list
// until the next load, which is fine for a greeting.
const today = ref<Date | null>(null)
const dismissed = ref<string[]>([])

/**
 * Dismissals are per idol and per day: closing one announcement hides it until
 * tomorrow, and an idol sharing the date still shows. Stored with the date they
 * belong to, so yesterday's never hide anything today.
 */
function readDismissed(dateKey: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? 'null')
    return stored?.date === dateKey && Array.isArray(stored.ids) ? stored.ids : []
  } catch {
    return []
  }
}

function dismiss(idol: Idol) {
  if (!today.value) return
  dismissed.value = [...dismissed.value, idol.id]
  try {
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ date: localDateKey(today.value), ids: dismissed.value }),
    )
  } catch {
    // Storage unavailable — it stays closed for this page load.
  }
}

onMounted(async () => {
  const now = new Date()
  dismissed.value = readDismissed(localDateKey(now))
  today.value = now
  // Shared with the listing pages, so on most of them this is already loaded.
  await referenceStore.ensureLoaded()
})

const groupName = (idol: Idol) =>
  referenceStore.groups.find((g) => g.id === idol.group)?.name ?? null

const celebrating = computed(() => {
  const day = today.value
  if (!day) return []
  return referenceStore.idols
    .filter((idol) => isBirthdayOn(idol.birthday, day) && !dismissed.value.includes(idol.id))
    .map((idol) => {
      const age = ageTurning(idol.birthday, day)
      const group = groupName(idol)
      return {
        idol,
        description: [group, age ? `turns ${age} today` : 'birthday today']
          .filter(Boolean)
          .join(' · '),
        // The same token the filter bar writes, so a shared name (three
        // Chaewons) opens the right one.
        to: {
          path: '/',
          query: {
            idol: idolQueryToken(idol, referenceStore.idols, referenceStore.groups),
          },
        },
      }
    })
    .toSorted((a, b) => a.idol.name.localeCompare(b.idol.name))
})
</script>

<template>
  <div v-if="celebrating.length" class="flex flex-col gap-2 mb-4">
    <UAlert
      v-for="{ idol, description, to } in celebrating"
      :key="idol.id"
      color="primary"
      variant="subtle"
      icon="i-lucide-cake"
      orientation="horizontal"
      :title="`Happy birthday, ${idol.name}!`"
      :description="description"
      :actions="[{ label: `See ${idol.name}'s posts`, to, color: 'primary', variant: 'solid' }]"
      close
      @update:open="dismiss(idol)"
    />
  </div>
</template>
