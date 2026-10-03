import type { ContentFormat, Settings, UniformCardRatio } from '~/types/typesSettings'
import { ref } from 'vue'

/**
 * What a browser with nothing stored yet gets. Exported so the settings dialog
 * can seed its draft from the same object instead of its own copy, which had
 * drifted to the pre-August 3 columns and 12 per page.
 */
export const DEFAULT_SETTINGS: Settings = {
  // 4 and 24 rather than 3 and 12: on any desktop the ladder actually allows 4
  // (from 1280px up), and a 4-wide grid of 12 is three rows — barely a screenful
  // before paginating. Only affects people with nothing stored yet; a returning
  // session keeps whatever it persisted, by design.
  columnCount: '4',
  contentCount: '24',
  // SD rather than HD for a first visit: the grid plays SD under either setting
  // (see resolveRenditionMode), so the difference is only the viewer, where 720p
  // H.264 plays on everything while 1080p AV1 needs a decoder the device may not
  // have. Someone who wants HD in the viewer picks it — a persisted choice this
  // default never overrides.
  contentFormat: 'SD MP4 (H264)',
  dataSavingMode: 'Disabled',
  noDistractionMode: 'Disabled',
  // Off by default: letterboxing is a real cost, and someone browsing a single
  // set of same-ratio fancams has nothing to gain from it.
  uniformCardRatio: 'Disabled',
}

// 5 and 6 exist for wide screens; useResponsiveColumns refuses them below
// 1800px / 2160px, so picking one on a laptop is a no-op rather than a grid of
// postage stamps.
const columnCountOptions = ['1', '2', '3', '4', '5', '6']
const contentCountOptions = ['12', '24', '48']
const contentFormatOptions: ContentFormat[] = ['HD MP4 (AV1)', 'SD MP4 (H264)', 'LD WebP']
const uniformCardRatioOptions: UniformCardRatio[] = ['Disabled', '16:9', '1:1', '4:5']

/**
 * The tab labels double as the stored values, so every rename leaves a cohort of
 * returning users holding a string that matches no tab. Unmapped, they fall to
 * the `else` branch below and get reset to the default — which silently undoes a
 * deliberate choice, and on a device with no AV1 decoder that means taking away
 * the SD setting someone picked precisely because HD didn't work. So each
 * generation of names maps forward:
 *
 *   'MP4' | 'AVIF'                              (original)
 *   'AV1 (HD)' | 'H264 (SD)' | 'Preview (AVIF/WEBP)'
 *   'HD MP4 (AV1)' | 'SD MP4 (H264)' | 'LD WebP'   (current)
 */
const LEGACY_CONTENT_FORMATS: Record<string, ContentFormat> = {
  MP4: 'HD MP4 (AV1)',
  AVIF: 'LD WebP',
  'AV1 (HD)': 'HD MP4 (AV1)',
  'H264 (SD)': 'SD MP4 (H264)',
  'Preview (AVIF/WEBP)': 'LD WebP',
}
const dataSavingModeOptions = ['Disabled', 'Enabled']
const noDistractionModeOptions = ['Disabled', 'Enabled']

export const useSettingsStore = defineStore(
  'settingsStore',
  () => {
    const isSettingsOpen = ref(false)
    const settingsAppliedAt = ref(0)
    const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

    function reset() {
      settings.value = { ...DEFAULT_SETTINGS }
    }

    return {
      isSettingsOpen,
      settingsAppliedAt,
      settings,
      columnCountOptions,
      contentCountOptions,
      contentFormatOptions,
      dataSavingModeOptions,
      noDistractionModeOptions,
      uniformCardRatioOptions,
      reset,
    }
  },
  {
    persist: {
      pick: ['settings'],
      afterHydrate: (ctx) => {
        const s = (ctx.store as any).settings as Settings | undefined
        if (!s) return

        // Hydration REPLACES `settings` with the persisted object, it doesn't
        // merge into it — so every returning user arrives holding whatever keys
        // existed when they last saved, and any setting added since is
        // `undefined` rather than its default. That renders an empty control and
        // then persists the hole. Backfilling here covers every future addition
        // as well as uniformCardRatio, which is the one that exposed it.
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
          if ((s as any)[key] === undefined) (s as any)[key] = value
        }
        // Same reset-rather-than-render-empty rule the content format follows.
        if (!uniformCardRatioOptions.includes(s.uniformCardRatio))
          s.uniformCardRatio = DEFAULT_SETTINGS.uniformCardRatio

        const migrated = LEGACY_CONTENT_FORMATS[s.contentFormat as string]
        if (migrated) s.contentFormat = migrated
        // Anything else unrecognised (hand-edited storage, a value from a
        // future build) also can't match a tab — reset rather than render an
        // empty control.
        else if (!contentFormatOptions.includes(s.contentFormat))
          s.contentFormat = DEFAULT_SETTINGS.contentFormat
      },
    },
  },
)
