<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * Fold duplicate uploader profiles into one. Admin only.
 *
 * Two steps, like DialogAdminMergeSets: picking the survivor is a real choice,
 * and the confirm screen is where the irreversible part gets stated.
 *
 * The one thing this dialog knows that the sets one doesn't: which record to
 * recommend. `user` is what grants its owner edit rights over everything attached
 * to the uploader and what puts that content in their own uploads, so the record
 * carrying an account is almost always the one to keep — a Discord-minted
 * uploader has none and cannot even be edited through the API.
 */
export interface MergeableUploader {
  id: string
  name: string
  created: string
  uploadCount: number
  avatarUrl: string | null
  /** The linked account, when there is one. Absent on Discord-minted records. */
  userName: string | null
  aliases: string
}

const props = defineProps<{
  isVisible: boolean
  uploaders: MergeableUploader[]
}>()

const emit = defineEmits<{
  'update:isVisible': [value: boolean]
  merged: []
}>()

const toast = useToast()
const { isMerging, mergeUploaders } = useMergeUploaders()

/**
 * Default to the record with an account, then to the busiest — never just the
 * first, which on this page is whatever sorted first by name.
 */
function recommendedTarget(list: MergeableUploader[]): string | null {
  if (list.length === 0) return null
  const withAccount = list.filter((u) => u.userName)
  const pool = withAccount.length > 0 ? withAccount : list
  return pool.reduce((best, u) => (u.uploadCount > best.uploadCount ? u : best), pool[0]!).id
}

const targetId = ref<string | null>(recommendedTarget(props.uploaders))
const isConfirming = ref(false)

const target = computed(() => props.uploaders.find((u) => u.id === targetId.value) ?? null)
const sources = computed(() => props.uploaders.filter((u) => u.id !== targetId.value))

const totalUploads = computed(() => props.uploaders.reduce((n, u) => n + u.uploadCount, 0))

/** Names that become aliases of the survivor, so the bot stops recreating them. */
const absorbedNames = computed(() => sources.value.map((u) => u.name).filter(Boolean))

/**
 * Flags merging away the only account-linked record — the one case where the
 * default has been overridden into a choice that loses something real.
 */
const losesAccount = computed(
  () => !target.value?.userName && sources.value.some((u) => u.userName),
)

function selectTarget(id: string) {
  targetId.value = id
}

async function commit() {
  if (!targetId.value || sources.value.length === 0) return
  try {
    const result = await mergeUploaders(
      targetId.value,
      sources.value.map((u) => u.id),
    )
    const moved = result.movedContent + result.movedSets
    toast.add({
      title: 'Merged',
      description:
        `${result.movedContent} upload${result.movedContent === 1 ? '' : 's'} and ` +
        `${result.movedSets} set${result.movedSets === 1 ? '' : 's'} moved to ${result.name}, ` +
        `${result.deleted.length} profile${result.deleted.length === 1 ? '' : 's'} removed.`,
      color: moved === 0 ? 'info' : 'success',
      duration: 5000,
    })
    emit('merged')
    close()
  } catch (error: any) {
    // 409 is the backend's count guard: a source gained a record mid-merge and
    // nothing was changed. Worth saying so rather than a generic failure.
    const status = error?.status
    toast.add({
      title: status === 409 ? 'Nothing was changed' : 'Merge failed',
      description: error?.response?.message ?? 'Could not merge these uploaders.',
      color: status === 409 ? 'warning' : 'error',
      duration: 5000,
    })
    isConfirming.value = false
  }
}

function close() {
  emit('update:isVisible', false)
}

function onBack() {
  if (isConfirming.value) isConfirming.value = false
  else close()
}

function onPrimary() {
  if (isConfirming.value) void commit()
  else isConfirming.value = true
}
</script>

<template>
  <UModal
    :open="isVisible"
    :title="isConfirming ? 'Confirm merge' : 'Merge uploaders'"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:isVisible', $event)"
  >
    <template #body>
      <!-- Pick the survivor -->
      <div v-if="!isConfirming">
        <p class="text-xs text-night-500 mb-3">
          Choose which profile to keep. The others' uploads and sets move onto it, their names
          become its aliases, and the emptied profiles are deleted.
        </p>

        <div class="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          <div
            v-for="uploader in uploaders"
            :key="uploader.id"
            class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200"
            :class="
              targetId === uploader.id
                ? 'border-pink-500/60 bg-pink-500/10'
                : 'border-white/8 bg-white/3 hover:border-pink-500/30 hover:bg-white/5'
            "
            @click="selectTarget(uploader.id)"
          >
            <div
              class="mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
              :class="targetId === uploader.id ? 'border-pink-400 bg-pink-400' : 'border-white/25'"
            >
              <div v-if="targetId === uploader.id" class="w-1.5 h-1.5 rounded-full bg-white" />
            </div>

            <div
              class="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center"
            >
              <img
                v-if="uploader.avatarUrl"
                :src="uploader.avatarUrl"
                :alt="uploader.name"
                class="w-full h-full object-cover"
              />
              <UIcon v-else name="i-lucide-user" class="text-night-500 text-xs" />
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-night-100 truncate">
                {{ uploader.name || uploader.id }}
              </p>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <!-- The deciding signal, so it is the most prominent badge. -->
                <UBadge
                  v-if="uploader.userName"
                  icon="i-lucide-user-check"
                  color="success"
                  variant="soft"
                  :label="`account: ${uploader.userName}`"
                  class="select-none text-xs!"
                />
                <UBadge
                  v-else
                  icon="i-lucide-unlink"
                  color="neutral"
                  variant="soft"
                  label="no account"
                  class="select-none text-xs!"
                />
                <UBadge
                  v-if="uploader.aliases"
                  icon="i-lucide-tags"
                  color="info"
                  variant="soft"
                  :label="uploader.aliases"
                  class="select-none text-xs!"
                />
              </div>
              <p class="text-xs text-night-500 mt-1.5 font-mono">
                {{ uploader.uploadCount }} upload{{ uploader.uploadCount === 1 ? '' : 's' }} · since
                {{ new Date(uploader.created).toLocaleDateString() }}
                <span v-if="targetId === uploader.id" class="text-pink-300">
                  · keeping this one</span
                >
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirm -->
      <div v-else class="flex flex-col gap-3 text-sm">
        <p>
          Merging <strong>{{ uploaders.length }}</strong> profiles ({{ totalUploads }} uploads) into
          <strong>«{{ target?.name || target?.id }}»</strong>.
        </p>

        <div class="flex flex-col gap-1 text-xs">
          <p class="text-night-400">These profiles will be deleted:</p>
          <p v-for="uploader in sources" :key="uploader.id" class="text-night-200 truncate">
            — {{ uploader.name || uploader.id }}
            <span v-if="uploader.userName" class="text-night-500">
              (account: {{ uploader.userName }})</span
            >
          </p>
        </div>

        <div v-if="absorbedNames.length" class="flex flex-col gap-1">
          <p class="text-xs text-night-400">
            Kept as aliases, so Discord ingestion resolves onto the survivor instead of recreating
            these:
          </p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="name in absorbedNames"
              :key="name"
              :label="name"
              color="info"
              variant="soft"
              class="text-xs!"
            />
          </div>
        </div>

        <p class="text-xs text-night-400">
          Uploads, sets, likes and view counts all follow the records — nothing is re-encoded and no
          file URL changes.
        </p>

        <div
          v-if="losesAccount"
          class="flex items-start gap-2 p-2.5 rounded-lg border border-amber-400/30 bg-amber-400/5"
        >
          <UIcon name="i-lucide-triangle-alert" class="text-amber-400 mt-0.5 shrink-0" />
          <p class="text-xs text-amber-200">
            You're keeping a profile with no linked account and deleting one that has it. Whoever
            owns that account will lose the ability to edit this content, and it will drop out of
            their My Uploads. Keeping the account-linked profile instead is almost always what you
            want.
          </p>
        </div>

        <p class="text-xs text-error-400">This cannot be undone.</p>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
          :label="isConfirming ? 'Back' : 'Cancel'"
          color="neutral"
          block
          :disabled="isMerging"
          @click="onBack"
        />
        <UButton
          :label="isConfirming ? 'Merge' : 'Continue'"
          color="success"
          block
          :disabled="!targetId || sources.length === 0"
          :loading="isMerging"
          @click="onPrimary"
        />
      </div>
    </template>
  </UModal>
</template>
