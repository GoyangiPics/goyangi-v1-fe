<script setup lang="ts">
import type { ContentsItem, Label, LabelJoin } from '~/types/appTypes'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

/**
 * Apply and remove labels on one piece of content.
 *
 * Named and structured to mirror QuickCollectionModal, since it is the same
 * interaction: a searchable list, checkbox rows, and inline creation of a new
 * entry. Differences come from labels being a shared namespace rather than a
 * per-user one — see the removal gate below.
 *
 * Opened from a grouped card it also gets the rest of the set, and a toggle to
 * label every post in it. Off by default, unlike the collection modal's: a
 * label describes what's in one picture ("hat", "mirror selca") far more often
 * than it describes a whole set, and labels that landed on thirty posts by
 * mistake can only come off one applier at a time.
 */
const props = defineProps<{
  isVisible: boolean
  content: ContentsItem
  /**
   * The whole set, clicked post included, when the caller holds it. Two or more
   * show the "every post in this set" toggle.
   */
  scopeItems?: ContentsItem[]
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  /**
   * Carries the content's full label list after the change, so the card that
   * opened this can patch its own `expand.labels` and re-render its chip row
   * without a refetch — the same in-place pattern useLikeItem uses for likes.
   */
  changed: [labels: Label[]]
}>()

const toast = useToast()
const { requireAuth } = useAuthGate()
const { isSearching, searchLabels, applyLabel, removeLabel, joinsFor, canRemove } = useLabels()

const term = ref('')
const results = ref<Label[]>([])
const applied = ref<Label[]>([])
const joins = ref<LabelJoin[]>([])
const isBusy = ref(false)
/** Per open, never remembered — see the note at the top. */
const allInSet = ref(false)

const others = computed(() => (props.scopeItems ?? []).filter((c) => c.id !== props.content.id))
const hasSet = computed(() => others.value.length > 0)
const setSize = computed(() => others.value.length + 1)

const appliedIds = computed(() => new Set(applied.value.map((l) => l.id)))

/** Exact-slug match suppresses the "Create" row — that label already exists. */
const exactMatch = computed(() => {
  const slug = toSlug(term.value)
  if (!slug) return null
  return results.value.find((l) => l.slug === slug) ?? null
})

const canCreate = computed(() => !!toSlug(term.value) && !exactMatch.value)

/** Results minus what's already on the content, which renders in its own group. */
const unappliedResults = computed(() => results.value.filter((l) => !appliedIds.value.has(l.id)))

function joinFor(labelId: string) {
  return joins.value.find((j) => j.label === labelId)
}

const runSearch = useDebounceFn(async () => {
  results.value = await searchLabels(term.value)
}, 250)

async function refresh() {
  joins.value = await joinsFor(props.content.id)
  // Read applied labels from the joins rather than expand.labels: this modal can
  // outlive the record it was opened from, and the joins are the source of truth.
  applied.value = joins.value.map((j) => j.expand?.label).filter((l): l is Label => !!l)
}

onMounted(async () => {
  await refresh()
  results.value = await searchLabels('')
})

/**
 * The rest of the set, after the clicked post has been done.
 *
 * Sequenced after it rather than alongside, for adds: the clicked post's apply
 * is what finds or creates the label, and several applies racing to create the
 * same new label could each make one. The posts are the card's live records,
 * so patching their `expand.labels` updates every chip row with no refetch.
 */
async function applyToOthers(label: Label) {
  const result = await runPool(others.value, async (post) => {
    const { applied: didApply } = await applyLabel(post.id, label.name)
    if (!didApply) return
    const current = post.expand?.labels ?? []
    applyLabelsToContent(post, [...current, label])
  })
  const n = result.done.length + 1
  toast.add({
    title: `Labelled ${n} post${n === 1 ? '' : 's'}`,
    description: result.failed.length ? `${result.failed.length} failed. Try again.` : undefined,
    color: result.failed.length ? 'warning' : 'success',
    duration: result.failed.length ? 5000 : 2000,
  })
}

/**
 * Removals cover the set too while the toggle is on — it's the undo for a
 * set-wide add. Only posts carrying the label are tried, and a post where
 * someone else applied it 403s under the delete rule and is left as it is.
 */
async function removeFromOthers(label: Label) {
  const carrying = others.value.filter((post) =>
    (post.expand?.labels ?? []).some((l: Label) => l.id === label.id),
  )
  const result = await runPool(carrying, async (post) => {
    await removeLabel(post.id, label.id)
    applyLabelsToContent(
      post,
      (post.expand?.labels ?? []).filter((l: Label) => l.id !== label.id),
    )
  })
  const n = result.done.length + 1
  toast.add({
    title: `Removed from ${n} post${n === 1 ? '' : 's'}`,
    description: result.failed.length
      ? `${result.failed.length} kept it — someone else added it there.`
      : undefined,
    color: 'success',
    duration: result.failed.length ? 4000 : 2000,
  })
}

async function add(name: string) {
  if (!requireAuth('add labels')) return
  isBusy.value = true
  try {
    const { label, applied: didApply } = await applyLabel(props.content.id, name)
    if (allInSet.value && hasSet.value) {
      await applyToOthers(label)
    } else if (!didApply) {
      toast.add({
        title: 'Already added',
        description: `"${label.name}" is already on this post.`,
        color: 'info',
        duration: 2000,
      })
    }
    term.value = ''
    await refresh()
    results.value = await searchLabels('')
    emit('changed', [...applied.value])
  } catch (error: any) {
    toast.add({
      title: "Couldn't add label",
      description: error?.response?.message ?? 'Try again.',
      color: 'error',
      duration: 3000,
    })
  } finally {
    isBusy.value = false
  }
}

async function remove(label: Label) {
  if (!requireAuth('remove labels')) return
  isBusy.value = true
  try {
    await removeLabel(props.content.id, label.id)
    if (allInSet.value && hasSet.value) await removeFromOthers(label)
    await refresh()
    emit('changed', [...applied.value])
  } catch {
    toast.add({
      title: "Couldn't remove label",
      description: 'Only the person who added it can remove it.',
      color: 'warning',
      duration: 3000,
    })
  } finally {
    isBusy.value = false
  }
}

function close() {
  emit('update:isVisible', false)
}
</script>

<template>
  <UModal
    :open="isVisible"
    title="Labels"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <p class="text-xs text-night-500 mb-3">
        Anyone can add labels, like "hat" or "mirror selca".
      </p>

      <div v-if="hasSet" class="mb-3 rounded-lg border border-white/10 px-3 py-2.5">
        <UCheckbox v-model="allInSet" :label="`Label all ${setSize} posts in this set`" />
        <p class="mt-1 pl-6 text-xs text-night-500">
          Adds and removals cover the whole set, not just this post.
        </p>
      </div>

      <UInput
        v-model="term"
        placeholder="Search or create a label…"
        icon="i-lucide-search"
        :loading="isSearching"
        autofocus
        class="w-full mb-3"
        @update:model-value="runSearch"
        @keydown.enter="canCreate ? add(term) : undefined"
      />

      <!-- On this content -->
      <div v-if="applied.length" class="mb-3">
        <p class="micro-label text-night-400 mb-1.5">On this post</p>
        <div class="flex flex-wrap gap-1.5">
          <div
            v-for="label in applied"
            :key="label.id"
            class="flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border border-primary/40 bg-primary/10"
          >
            <span class="text-xs">{{ label.name }}</span>
            <!-- Removal is gated on who applied it, not on ownership of the
                 content: anyone can label anything, but only the applier (or an
                 admin) can take it off. Others' labels show a reason rather than
                 a dead button. -->
            <UButton
              v-if="canRemove(joinFor(label.id))"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="isBusy"
              :aria-label="`Remove ${label.name}`"
              @click="remove(label)"
            />
            <UTooltip v-else text="Added by someone else" :content="{ side: 'top' }">
              <UIcon name="i-lucide-lock" class="text-xs text-night-500 mx-1" />
            </UTooltip>
          </div>
        </div>
      </div>

      <!-- Create -->
      <button
        v-if="canCreate"
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2.5 mb-2 rounded-lg border border-dashed border-white/15 text-sm text-night-300 hover:text-white hover:bg-white/5 transition-colors"
        :disabled="isBusy"
        @click="add(term)"
      >
        <UIcon name="i-lucide-plus" class="text-xs" />
        Create «{{ term.trim() }}»
      </button>

      <!-- Existing -->
      <div class="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
        <button
          v-for="label in unappliedResults"
          :key="label.id"
          type="button"
          class="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-transparent hover:bg-white/10 transition-colors text-left"
          :disabled="isBusy"
          @click="add(label.name)"
        >
          <UIcon name="i-lucide-tag" class="text-xs text-night-400 shrink-0" />
          <span class="flex-1 text-sm truncate">{{ label.name }}</span>
          <UIcon name="i-lucide-plus" class="text-xs text-night-500 shrink-0" />
        </button>

        <p
          v-if="!unappliedResults.length && !canCreate"
          class="text-center text-xs text-night-500 py-4"
        >
          No labels found.
        </p>
      </div>
    </template>

    <template #footer>
      <UButton label="Done" color="neutral" block @click="close" />
    </template>
  </UModal>
</template>
