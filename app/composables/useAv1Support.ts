import { ref } from 'vue'

/**
 * Whether this device can actually decode the AV1 video we serve.
 *
 * `canPlayType` is unreliable for this — Safari returns "probably" for AV1 even
 * on hardware with no AV1 decoder — so we use MediaCapabilities, which reports
 * `supported: false` when there's genuinely no decoder (verified on devices
 * without AV1 support). Computed once and shared module-wide.
 *
 * null = not yet determined. It's treated as "supported" by callers so the
 * common case renders video immediately with no flash; it flips to false only
 * once the check proves AV1 can't be decoded, which swaps cards to the AVIF
 * preview. The check runs client-only (MediaCapabilities is absent during SSR).
 */
const av1Supported = ref<boolean | null>(null)
let detectionStarted = false

async function detectAv1() {
  detectionStarted = true
  const mc = navigator.mediaCapabilities
  if (!mc?.decodingInfo) {
    // No MediaCapabilities at all (very old browser) — assume no AV1.
    av1Supported.value = false
    return
  }
  try {
    // 8-bit and 10-bit 4:2:0 Main — the two variants our content uses. Require
    // both, so a device that can't do 10-bit still falls back for gifs.
    const results = await Promise.all(
      ['av01.0.04M.08', 'av01.0.04M.10'].map((codecs) =>
        mc.decodingInfo({
          type: 'file',
          video: {
            contentType: `video/mp4; codecs="${codecs}"`,
            width: 640,
            height: 1080,
            bitrate: 1_500_000,
            framerate: 30,
          },
        }),
      ),
    )
    av1Supported.value = results.every((r) => r.supported)
  } catch {
    av1Supported.value = false
  }
}

export function useAv1Support() {
  if (import.meta.client && !detectionStarted) void detectAv1()
  return av1Supported
}
