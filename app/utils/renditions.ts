/**
 * The warning attached to every control that hands over the AV1 rendition.
 *
 * Safari never software-decodes AV1, so Apple devices below A17 Pro / M3 don't
 * degrade on an AV1 mp4 — they render nothing. The file downloads or copies
 * perfectly and then simply refuses to play, which is impossible to diagnose from
 * the receiving end. The SD rendition (H.264 720p) exists for those devices; see
 * hooks/h264.go in the backend for why that codec specifically.
 *
 * One constant so the per-item menu, the bulk download menu and anything added
 * later all say the same thing.
 */
export const AV1_COMPAT_HINT =
  'AV1 1080p — might not be supported on older devices. Use SD for those.'
