/**
 * The most actionable human-readable line inside a PocketBase error.
 *
 * PocketBase 400s carry per-field errors ({ data: { title: { message, code } } }),
 * and the first field's message is almost always the one worth showing —
 * "title: Missing required value." beats "Failed to create record.". Falls
 * back through the response-level message to the caller's default.
 */
export function pbErrorDetail(err: any, fallback: string): string {
  const fieldErrors = err?.response?.data ?? err?.data?.data
  let detail: string = err?.response?.message || err?.message || fallback
  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstField = Object.keys(fieldErrors)[0]
    if (firstField) {
      const fieldErr = fieldErrors[firstField]
      detail = `${firstField}: ${fieldErr?.message || fieldErr?.code || detail}`
    }
  }
  return detail
}
