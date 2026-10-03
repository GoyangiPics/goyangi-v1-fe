<script setup lang="ts">
import type { PropagatableField } from '~/composables/useSetPropagate'
import type { Idol, SetsItem, SetsUnifiedItem } from '~/types/appTypes'
import { CalendarDate } from '@internationalized/date'
import { computed, onMounted, reactive, ref } from 'vue'

/**
 * Edit a set's metadata, optionally pushing changes down to its clips.
 *
 * A modal rather than the wrench popover the per-clip editor uses: the confirm
 * step and progress need the room, and there's no menu-dismiss race to fight.
 */
const props = defineProps<{
  isVisible: boolean
  set: SetsItem | SetsUnifiedItem
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  saved: []
}>()

const pb = usePocketBase()
const toast = useToast()
const referenceStore = useReferenceStore()
const { isRunning, countChildren, propagate } = useSetPropagate()

const isSaving = ref(false)
const childCount = ref<number | null>(null)
/** The dialog body swaps to a summary before anything is written. */
const isConfirming = ref(false)

const form = reactive({
  title: '',
  idol: [] as Idol[],
  date: null as Date | null,
})

/** What the set looked like on open, for the dirty check. */
const initial = reactive({
  title: '',
  idolIds: [] as string[],
  dateISO: '' as string,
})

// Groups are never picked directly anywhere in the app — always derived from the
// selected idols, so the two can't disagree.
const inferredGroups = computed(() => inferGroups(form.idol, referenceStore.groups))

const toCal = (d: Date | null) =>
  d ? new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) : undefined
const fromCal = (c?: { year: number; month: number; day: number } | null) =>
  c ? new Date(c.year, c.month - 1, c.day) : null
const dateModel = computed({
  get: () => toCal(form.date),
  set: (v) => {
    form.date = fromCal(v)
  },
})

onMounted(async () => {
  const s = props.set as any
  form.title = s.title ?? ''
  form.idol = ((s.expand?.idol ?? []) as Idol[]).slice()
  form.date = s.date ? new Date(s.date) : null

  initial.title = form.title
  initial.idolIds = form.idol.map((i) => i.id).toSorted()
  initial.dateISO = form.date ? form.date.toISOString() : ''

  try {
    childCount.value = await countChildren(props.set.id)
  } catch {
    childCount.value = null
  }
})

// ─── Dirty tracking ─────────────────────────────────────────────────────────
// The propagate block lists ONLY the fields actually changed, each checked by
// default. Defaulting every field on would mean fixing a typo in the title also
// silently rewrote `date` and `idol` on every clip — which for a merged or
// hand-curated set are often deliberately different per clip.

const titleDirty = computed(() => form.title !== initial.title)
const idolDirty = computed(
  () => JSON.stringify(form.idol.map((i) => i.id).toSorted()) !== JSON.stringify(initial.idolIds),
)
const dateDirty = computed(() => (form.date ? form.date.toISOString() : '') !== initial.dateISO)

const isDirty = computed(() => titleDirty.value || idolDirty.value || dateDirty.value)

/** Which dirty fields to push down. Idols and groups are one choice — see below. */
const propagateChoice = reactive({
  title: true,
  idol: true,
  date: true,
})

const propagatableDirty = computed(() => {
  const out: Array<{ key: 'title' | 'idol' | 'date'; label: string; preview: string }> = []
  if (titleDirty.value) {
    out.push({ key: 'title', label: 'Title', preview: form.title || '(empty)' })
  }
  if (idolDirty.value) {
    out.push({
      key: 'idol',
      // One checkbox for both: propagating idols without their derived groups
      // would leave children internally inconsistent.
      label: 'Idols & groups',
      preview: form.idol.map((i) => i.name).join(', ') || '(none)',
    })
  }
  if (dateDirty.value) {
    out.push({
      key: 'date',
      label: 'Date',
      preview: form.date ? form.date.toLocaleDateString() : '(cleared)',
    })
  }
  return out
})

const selectedPropagateFields = computed<PropagatableField[]>(() => {
  const fields: PropagatableField[] = []
  for (const entry of propagatableDirty.value) {
    if (!propagateChoice[entry.key]) continue
    if (entry.key === 'idol') fields.push('idol', 'group')
    else fields.push(entry.key)
  }
  return fields
})

const willPropagate = computed(() => selectedPropagateFields.value.length > 0)

// ─── Save ───────────────────────────────────────────────────────────────────

function requestSave() {
  if (!isDirty.value) {
    close()
    return
  }
  // Skip the confirm step when nothing propagates — editing just the set record
  // is cheap and reversible.
  if (!willPropagate.value) {
    void commit()
    return
  }
  isConfirming.value = true
}

async function commit() {
  isSaving.value = true
  try {
    // The set record first: propagation copies FROM the set, so it has to be the
    // new values that get pushed down.
    await pb.collection('contents_sets').update(props.set.id, {
      title: form.title,
      idol: form.idol.map((i) => i.id),
      group: inferredGroups.value.map((g) => g.id),
      date: form.date ? form.date.toISOString() : '',
    })

    if (willPropagate.value) {
      const result = await propagate(props.set.id, selectedPropagateFields.value)
      toast.add({
        title: 'Set updated',
        description: `${result.updated} clip${result.updated === 1 ? '' : 's'} updated.`,
        color: 'success',
        duration: 3000,
      })
    } else {
      toast.add({ title: 'Set updated', color: 'success', duration: 2000 })
    }

    emit('saved')
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error?.response?.message ?? 'Could not save the set.',
      color: 'error',
      duration: 4000,
    })
    isConfirming.value = false
  } finally {
    isSaving.value = false
  }
}

function close() {
  emit('update:isVisible', false)
}

// Named, not inline ternaries in the template: UButton's click emit is typed
// void and an assignment/ternary expression evaluates to a value.
function onBack() {
  if (isConfirming.value) isConfirming.value = false
  else close()
}

function onPrimary() {
  if (isConfirming.value) void commit()
  else requestSave()
}
</script>

<template>
  <UModal
    :open="isVisible"
    :title="isConfirming ? 'Confirm changes' : 'Edit set'"
    :ui="{ content: 'sm:max-w-lg overflow-visible', body: 'overflow-visible' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <!-- Edit -->
      <div v-if="!isConfirming" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Title</label>
          <UInput v-model="form.title" size="sm" placeholder="Title..." />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Idols</label>
          <IdolSelectMenu v-model="form.idol" size="sm" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Groups</label>
          <div class="flex flex-wrap gap-1 min-h-8 items-center">
            <UBadge
              v-for="group in inferredGroups"
              :key="group.id"
              :label="group.name"
              color="info"
              variant="soft"
            />
            <span v-if="!inferredGroups.length" class="text-xs text-night-500">
              Derived from the selected idols
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Date</label>
          <!-- portal=false renders the calendar inside the modal (a modal traps
               pointer events, so a body-portaled one would be unclickable). But
               UModal's content and body are overflow-hidden/auto, so the popover
               got clipped at the modal's edge with only its header showing — hence
               the overflow-visible overrides on the UModal above. -->
          <DateField v-model="dateModel" size="sm" :portal="false" />
        </div>

        <!-- Only the fields actually changed appear here, each checked by
             default. That is "per-field opt-out" without a destructive default. -->
        <div
          v-if="propagatableDirty.length && childCount"
          class="flex flex-col gap-2 p-3 rounded-lg border border-white/10 bg-white/2"
        >
          <p class="text-xs text-night-300">
            Also apply to all {{ childCount }} clip{{ childCount === 1 ? '' : 's' }} in this set:
          </p>
          <UCheckbox
            v-for="entry in propagatableDirty"
            :key="entry.key"
            v-model="propagateChoice[entry.key]"
            size="sm"
          >
            <template #label>
              <span class="text-xs">
                {{ entry.label }}
                <span class="text-night-500">→ {{ entry.preview }}</span>
              </span>
            </template>
          </UCheckbox>
        </div>
      </div>

      <!-- Confirm -->
      <div v-else class="flex flex-col gap-3">
        <p class="text-sm text-night-300">
          Applying to <strong>{{ childCount }}</strong> clip{{ childCount === 1 ? '' : 's' }}:
        </p>
        <div class="flex flex-col gap-1.5">
          <div
            v-for="entry in propagatableDirty.filter((e) => propagateChoice[e.key])"
            :key="entry.key"
            class="flex items-baseline gap-2 text-xs"
          >
            <span class="text-night-400 w-24 shrink-0">{{ entry.label }}</span>
            <span class="text-night-100">{{ entry.preview }}</span>
          </div>
        </div>
        <p class="text-xs text-error-400">
          This rewrites {{ childCount }} content record{{ childCount === 1 ? '' : 's' }} and cannot
          be undone.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
          :label="isConfirming ? 'Back' : 'Cancel'"
          color="neutral"
          block
          :disabled="isSaving || isRunning"
          @click="onBack"
        />
        <UButton
          :label="isConfirming ? 'Apply' : 'Save'"
          color="success"
          block
          :disabled="!isDirty"
          :loading="isSaving || isRunning"
          @click="onPrimary"
        />
      </div>
    </template>
  </UModal>
</template>
