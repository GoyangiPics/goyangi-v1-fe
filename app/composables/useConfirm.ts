import type { ButtonProps } from '@nuxt/ui'
import { ConfirmModal } from '#components'

export type ConfirmOptions = {
  title?: string
  message: string
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Color of the confirm button — pass 'error' for destructive actions. */
  color?: ButtonProps['color']
}

/**
 * Promise-based confirm dialog (replaces PrimeVue's useConfirm service).
 * Call in setup, use anywhere:
 *
 *   const confirm = useConfirm()
 *   if (await confirm({ message: 'Delete "x"?', color: 'error' })) { … }
 *
 * Resolves `false` when dismissed via escape/backdrop.
 */
export function useConfirm() {
  const overlay = useOverlay()
  const modal = overlay.create(ConfirmModal)

  return async (options: ConfirmOptions): Promise<boolean> => {
    const value = await modal.open(options)
    return value === true
  }
}
