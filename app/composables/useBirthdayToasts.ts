import { onMounted } from 'vue'
import { isBirthdayOn, localDateKey } from '~/utils/birthdays'
import { idolDisplayName, idolQueryToken } from '~/utils/idolSelection'

const SHOWN_KEY = 'goyangi:birthdaysShown'

/** Long enough to reach the button; the toast still closes on its own. */
const BIRTHDAY_TOAST_DURATION = 10_000

/**
 * Ids already announced today in this browser. Stored with the date they
 * belong to, so yesterday's list never suppresses anything today.
 */
function readShown(dateKey: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? 'null')
    return stored?.date === dateKey && Array.isArray(stored.ids) ? stored.ids : []
  } catch {
    return []
  }
}

function writeShown(dateKey: string, ids: string[]) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify({ date: dateKey, ids }))
  } catch {
    // Storage unavailable — the toasts come back on the next load, which is
    // the harmless way to fail.
  }
}

/**
 * One toast per idol whose birthday is today, each with a button to that
 * idol's posts on the home grid.
 *
 * Once per idol per day per browser: a toast on every reload or every visit
 * that day would turn a greeting into noise. "Today" is the visitor's own
 * calendar day, so this runs on mount — the server knows neither that nor
 * their storage.
 */
export function useBirthdayToasts() {
  const referenceStore = useReferenceStore()
  const toast = useToast()

  onMounted(async () => {
    const today = new Date()
    const dateKey = localDateKey(today)
    // Shared with the listing pages, so on most of them this is already loaded.
    await referenceStore.ensureLoaded()

    const shown = readShown(dateKey)
    const celebrating = referenceStore.idols
      .filter((idol) => isBirthdayOn(idol.birthday, today) && !shown.includes(idol.id))
      .toSorted((a, b) => a.name.localeCompare(b.name))
    if (!celebrating.length) return

    for (const idol of celebrating) {
      // Qualified with the group only for a shared name ("Chaewon · tripleS").
      const name = idolDisplayName(idol, referenceStore.idols, referenceStore.groups)
      toast.add({
        id: `birthday-${idol.id}`,
        title: `Happy birthday, ${name}!`,
        icon: 'i-lucide-cake',
        color: 'primary',
        duration: BIRTHDAY_TOAST_DURATION,
        actions: [
          {
            label: 'See posts',
            color: 'primary',
            variant: 'solid',
            // The same token the filter bar writes, so a shared name opens
            // the right idol.
            to: {
              path: '/',
              query: {
                idol: idolQueryToken(idol, referenceStore.idols, referenceStore.groups),
              },
            },
          },
        ],
      })
    }
    writeShown(dateKey, [...shown, ...celebrating.map((idol) => idol.id)])
  })
}
