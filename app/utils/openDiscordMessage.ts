/** `channels/<guild-or-@me>/<channel>[/<message>]`, wherever it appears. */
const CHANNELS_PATH_RE = /channels\/(?:@me|\d+)\/\d+(?:\/\d+)?/

/** How long to wait for the OS to hand off to the app before falling back. */
const HANDOFF_GRACE_MS = 900

/**
 * Jump to a Discord message.
 *
 * Records store the *web* URL (`https://discord.com/channels/<guild>/<channel>/<message>`),
 * so the old `discord://${record.discord}` produced
 * `discord://https://discord.com/…` and silently did nothing. The app scheme
 * wants a bare path behind a `-` placeholder host: `discord://-/channels/…`.
 *
 * The app gets first refusal (that's the point of the menu item — land in the
 * client, at the message). Custom schemes fail silently when nothing is
 * registered to handle them, so if the page is still in the foreground shortly
 * after, we open the web URL instead rather than leaving the click dead.
 */
export function openDiscordMessage(link: string | null | undefined) {
  const raw = link?.trim()
  if (!raw) return

  const path = CHANNELS_PATH_RE.exec(raw)?.[0]
  if (!path) {
    // Not a shape we recognize — open it verbatim if it's at least a URL.
    if (/^https?:\/\//i.test(raw)) window.open(raw, '_blank', 'noopener')
    return
  }

  // A blur or a visibility flip means the OS took over and the app is opening.
  let handedOff = false
  const markHandedOff = () => {
    handedOff = true
  }
  window.addEventListener('blur', markHandedOff, { once: true })
  document.addEventListener('visibilitychange', markHandedOff, { once: true })

  // Assigning location.href is safe for a non-http scheme (the page itself
  // never navigates) and is handled more reliably than clicking a detached
  // anchor, which some browsers ignore for custom schemes.
  window.location.href = `discord://-/${path}`

  setTimeout(() => {
    window.removeEventListener('blur', markHandedOff)
    document.removeEventListener('visibilitychange', markHandedOff)
    if (handedOff || document.hidden) return
    // May be swallowed by the popup blocker this far from the click; that just
    // leaves us where the app-scheme attempt already was.
    window.open(`https://discord.com/${path}`, '_blank', 'noopener')
  }, HANDOFF_GRACE_MS)
}
