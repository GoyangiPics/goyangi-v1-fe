/**
 * Download a remote file by fetching it as a blob and clicking a transient
 * anchor. Falls back to opening the URL in a new tab if the fetch fails
 * (e.g. CORS). Shared by content cards and the content actions menu.
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  const name = filename ?? url.split('/').pop()?.split('?')[0] ?? 'download'
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = name
    a.click()
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}
