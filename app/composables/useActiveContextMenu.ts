import { ref } from 'vue'

const activeMenu = ref<{ hide: () => void } | null>(null)

export function useActiveContextMenu() {
  function register(menu: { hide: () => void }) {
    if (activeMenu.value && activeMenu.value !== menu) activeMenu.value.hide()
    activeMenu.value = menu
  }

  function unregister(menu: { hide: () => void }) {
    if (activeMenu.value === menu) activeMenu.value = null
  }

  return { register, unregister }
}
