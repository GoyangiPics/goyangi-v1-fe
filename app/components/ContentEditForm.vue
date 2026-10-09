<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import { computed, onMounted, reactive, ref } from 'vue'

/**
 * Edit one content record's metadata.
 *
 * Extracted from UploadsActionsMenu once the admin context menu needed the same
 * fields and the same write — the alternative was a second copy of the form and
 * its save, which would then drift the moment a field is added.
 *
 * Container-agnostic: it renders the fields and its own buttons, and the caller
 * decides whether that lives in a popover (the uploads wrench) or a modal (the
 * admin menu). State is seeded on mount, so a caller that unmounts the form when
 * its container closes gets fresh values on every open for free.
 */
const props = defineProps<{
  content: any
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const pb = usePocketBase()
const referenceStore = useReferenceStore()
const toast = useToast()

const isSaving = ref(false)

const form = reactive({
  title: '',
  idol: [] as any[],
  tag: [] as any[],
  date: null as Date | null,
  source: '',
  filetype: '',
})

// UInputDate works with CalendarDate, the form with JS Date — bridge here.
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

const fileTypeOptions = [
  { label: 'Video', value: 'video' },
  { label: 'Image', value: 'image' },
]

const inferredGroups = computed(() => inferGroups(form.idol, referenceStore.groups))

onMounted(() => {
  const c = props.content
  form.title = c.title || ''
  // The expand when the caller fetched one, otherwise resolved from the id list
  // against the reference store — listing queries don't all expand relations.
  form.idol = c.expand?.idol ?? referenceStore.idols.filter((i: any) => c.idol?.includes(i.id))
  form.tag = c.expand?.tag ?? referenceStore.tags.filter((t: any) => c.tag?.includes(t.id))
  form.date = c.date ? new Date(c.date) : null
  form.source = c.source || ''
  form.filetype = c.filetype || ''
})

async function save() {
  isSaving.value = true
  try {
    await pb.collection('contents').update(props.content.id, {
      title: form.title,
      idol: form.idol.map((i: any) => i.id),
      // Never edited directly: groups are always what the chosen idols imply, so
      // the two cannot disagree. Same rule as the upload form and DialogSetEdit.
      group: inferredGroups.value.map((g: any) => g.id),
      tag: form.tag.map((t: any) => t.id),
      date: form.date ? form.date.toISOString() : '',
      source: form.source,
      filetype: form.filetype,
    })
    toast.add({ title: 'Saved', color: 'success', duration: 2000 })
    emit('saved')
  } catch (error: any) {
    toast.add({
      title: "Couldn't save",
      description: pbErrorDetail(error, 'Try again.'),
      color: 'error',
      duration: 3000,
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <label class="text-xs text-night-400">Title</label>
      <UInput v-model="form.title" size="sm" placeholder="Add a title" />
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
          :key="(group as any).id"
          :label="(group as any).name"
          color="info"
          variant="soft"
        />
        <span v-if="!inferredGroups.length" class="text-xs text-night-500">
          Added from the idols you pick
        </span>
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs text-night-400">Tags</label>
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
        <label class="text-xs text-night-400">File type</label>
        <USelect
          v-model="form.filetype"
          :items="fileTypeOptions"
          size="sm"
          placeholder="Pick a type"
        />
      </div>
      <div class="flex flex-col gap-1 flex-1">
        <label class="text-xs text-night-400">Date</label>
        <!-- Never portalled: both containers this form lives in (a popover and
             a modal) trap pointer events, so a body-portaled calendar would be
             unclickable. -->
        <DateField v-model="dateModel" size="sm" :portal="false" />
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs text-night-400">Source</label>
      <UInput v-model="form.source" size="sm" placeholder="YouTube, Instagram…" />
    </div>
    <div class="flex gap-2 pt-1">
      <UButton label="Cancel" color="neutral" size="sm" block @click="emit('cancel')" />
      <UButton label="Save" color="success" size="sm" block :loading="isSaving" @click="save" />
    </div>
  </div>
</template>
