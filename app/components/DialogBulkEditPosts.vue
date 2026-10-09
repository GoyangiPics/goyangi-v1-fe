<script setup lang="ts">
import type { ContentsItem } from '~/types/appTypes'
import { CalendarDate } from '@internationalized/date'
import { computed, reactive, ref } from 'vue'

/**
 * Edit many posts at once. Additive where it matters: picked idols and tags are
 * ADDED to each post (with the groups they imply), never replacing what's
 * there, so one wrong click can't wipe a selection's metadata. Date and source
 * are set only when filled in.
 */
const props = defineProps<{
  isVisible: boolean
  posts: ContentsItem[]
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  saved: [doneIds: string[]]
}>()

const pb = usePocketBase()
const referenceStore = useReferenceStore()
const { run } = useBulkAction()

const form = reactive({
  idol: [] as any[],
  tag: [] as any[],
  date: null as Date | null,
  source: '',
})
const isSaving = ref(false)

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

const inferredGroups = computed(() => inferGroups(form.idol, referenceStore.groups))
const hasChanges = computed(
  () => form.idol.length > 0 || form.tag.length > 0 || !!form.date || !!form.source.trim(),
)

function patch(): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (form.idol.length) {
    body['idol+'] = form.idol.map((i: any) => i.id)
    body['group+'] = inferredGroups.value.map((g: any) => g.id)
  }
  if (form.tag.length) body['tag+'] = form.tag.map((t: any) => t.id)
  if (form.date) body.date = form.date.toISOString()
  if (form.source.trim()) body.source = form.source.trim()
  return body
}

async function save() {
  isSaving.value = true
  try {
    const body = patch()
    const result = await run({
      items: props.posts,
      action: (post) => pb.collection('contents').update(post.id, body, { requestKey: null }),
      progress: 'Saving…',
      success: (n) => `Updated ${n} post${n === 1 ? '' : 's'}`,
      failure: "Couldn't update posts",
    })
    emit(
      'saved',
      result.done.map((p) => p.id),
    )
    if (!result.failed.length) emit('update:isVisible', false)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    :open="isVisible"
    :title="`Edit ${posts.length} post${posts.length === 1 ? '' : 's'}`"
    description="Idols and tags are added to what's there. Leave a field empty to keep it as is."
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Add idols</label>
          <IdolSelectMenu v-model="form.idol" size="sm" />
          <div v-if="inferredGroups.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="group in inferredGroups"
              :key="(group as any).id"
              :label="(group as any).name"
              color="info"
              variant="soft"
              size="sm"
            />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-night-400">Add tags</label>
          <USelectMenu
            v-model="form.tag"
            multiple
            by="id"
            :items="referenceStore.tags"
            label-key="name"
            placeholder="Pick tags"
            size="sm"
          />
        </div>
        <div class="flex gap-3">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs text-night-400">Set date</label>
            <DateField v-model="dateModel" size="sm" :portal="false" />
          </div>
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs text-night-400">Set source</label>
            <UInput v-model="form.source" size="sm" placeholder="YouTube, Instagram…" />
          </div>
        </div>
        <div class="flex gap-2 pt-1">
          <UButton
            label="Cancel"
            color="neutral"
            size="sm"
            block
            @click="emit('update:isVisible', false)"
          />
          <UButton
            label="Save"
            color="success"
            size="sm"
            block
            :disabled="!hasChanges"
            :loading="isSaving"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
