import { computed } from 'vue'

/**
 * Masonry column count derived from the user's `columnCount` setting, clamped
 * down on viewports too narrow to hold that many cards at a readable size.
 * Single source for the breakpoints previously copy-pasted into every list page.
 *
 * The setting is a CEILING, never a target: this only ever returns the same or
 * less, so widening the layout can't override a deliberate choice.
 *
 * The ladder itself lives in ~/utils/responsiveColumns, where it's unit-tested —
 * columns stretch to fill, so a wrong threshold doesn't overflow or wrap, it just
 * silently shrinks every card.
 */
export function useResponsiveColumns() {
  const settingsStore = useSettingsStore()
  const { width } = useWindowSize()

  const colCount = computed(() =>
    resolveColumnCount(Number.parseInt(settingsStore.settings.columnCount), width.value),
  )

  return { colCount }
}
