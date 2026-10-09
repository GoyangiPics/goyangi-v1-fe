/**
 * Save and delete for a collection the viewer owns — shared by My collections
 * and the collection page, which used to have no owner tools at all.
 */
export function useCollectionActions() {
  const pb = usePocketBase()
  const toast = useToast()
  const confirm = useConfirm()

  /** Updates in place on success, so the caller's card or header reflects it. */
  async function saveCollection(
    collection: { id: string; title: string; isPublic: boolean },
    changes: { title: string; isPublic: boolean },
  ) {
    try {
      await pb.collection('contents_collections').update(collection.id, changes)
      collection.title = changes.title
      collection.isPublic = changes.isPublic
      toast.add({ title: 'Collection saved', color: 'success', duration: 2000 })
      return true
    } catch {
      toast.add({ title: "Couldn't save collection", color: 'error', duration: 3000 })
      return false
    }
  }

  /** Asks first. Resolves true once it's deleted. */
  async function deleteCollection(collection: { id: string; title: string }) {
    const ok = await confirm({
      title: `Delete "${collection.title}"?`,
      message: "The posts in it aren't deleted. This can't be undone.",
      icon: 'i-lucide-trash-2',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      color: 'error',
    })
    if (!ok) return false
    try {
      await pb.collection('contents_collections').delete(collection.id)
      toast.add({ title: 'Collection deleted', color: 'success', duration: 2000 })
      return true
    } catch {
      toast.add({ title: "Couldn't delete collection", color: 'error', duration: 3000 })
      return false
    }
  }

  return { saveCollection, deleteCollection }
}
