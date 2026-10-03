<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

useHead({ title: 'GIF Tool' })

const config = useRuntimeConfig()
const toast = useToast()

// Matches the upload page: /api/convert/ goes through the same Cloudflare
// proxy, which rejects bodies over 100 MB before the backend sees them.
const MAX_FILE_SIZE_MB = 100

// Output format for the animated preview. WebP by default — widest device
// support; AVIF is smaller but not universally decodable yet. Mirrors the gif
// upload default. Selects which /api/convert/{format} endpoint is hit and the
// downloaded file's extension.
const formatOptions = [
  { label: 'WebP — widest device support', value: 'webp' },
  { label: 'AVIF — smallest, newer devices', value: 'avif' },
]
const selectedFormat = ref<'webp' | 'avif'>('webp')

const selectedFile = ref<File | null>(null)
const isConverting = ref(false)
const lastResult = ref<{
  inputName: string
  inputSize: number
  outputSize: number
  durationMs: number
} | null>(null)

const previewUrl = ref<string | null>(null)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

const sizeReduction = computed(() => {
  if (!lastResult.value) return null
  const { inputSize, outputSize } = lastResult.value
  if (inputSize <= 0) return null
  const ratio = outputSize / inputSize
  const percent = (1 - ratio) * 100
  return { ratio, percent }
})

function onFileSelect(file: File | null) {
  if (!file) return

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    toast.add({
      title: 'File too large',
      description: `"${file.name}" is ${formatSize(file.size)}. Max is ${MAX_FILE_SIZE_MB} MB.`,
      color: 'error',
      duration: 4000,
    })
    return
  }

  selectedFile.value = file
  // Revoke previous preview if any
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  lastResult.value = null
}

// UFileUpload model — the dropzone is only rendered while no file is
// selected, so the displayed model stays empty; selections are validated
// and accepted (or rejected) by onFileSelect.
const fileUploadModel = computed<File | null>({
  get: () => null,
  set: (file) => onFileSelect(file),
})

function clearSelection() {
  selectedFile.value = null
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  lastResult.value = null
}

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

function triggerDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Slight delay before revoking so the download has time to register
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

async function convert() {
  if (!selectedFile.value || isConverting.value) return

  const file = selectedFile.value
  isConverting.value = true
  lastResult.value = null
  const t0 = performance.now()

  try {
    const fd = new FormData()
    fd.append('file', file, file.name)

    const baseUrl = (config.public.baseUrl as string).replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/convert/${selectedFormat.value}`, {
      method: 'POST',
      body: fd,
    })

    if (!res.ok) {
      let detail = `Server returned ${res.status}`
      try {
        const errJson = await res.json()
        detail = errJson?.message || errJson?.data?.message || detail
      } catch {
        try {
          detail = await res.text()
        } catch {
          /* ignore */
        }
      }
      throw new Error(detail)
    }

    const outBlob = await res.blob()
    const durationMs = Math.round(performance.now() - t0)

    lastResult.value = {
      inputName: file.name,
      inputSize: file.size,
      outputSize: outBlob.size,
      durationMs,
    }

    // Auto-trigger download (fall back to the full name if it has no extension).
    // Keep the same base name and just swap in the chosen preview extension.
    const baseName = file.name.replace(/\.[^.]+$/, '') || file.name
    const outName = `${baseName}.${selectedFormat.value}`
    triggerDownload(outBlob, outName)

    toast.add({
      title: 'Converted',
      description: `Saved ${outName} · ${formatSize(outBlob.size)}`,
      color: 'success',
      duration: 3000,
    })
  } catch (err: any) {
    console.error('Preview conversion failed:', err)
    toast.add({
      title: 'Conversion failed',
      description: err?.message || 'Unknown error',
      color: 'error',
      duration: 5000,
    })
  } finally {
    isConverting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex justify-start items-center">
      <NavigationBase class="mt-4 flex-1" />
    </div>

    <div class="mt-4">
      <PageHeader emoji="🎞️" title="Gif Tools" />
      <p class="text-sm text-night-400 mb-4 max-w-2xl">
        Upload a video (MP4, MOV, WebM, GIF, etc.) and get back a small animated preview — WebP or
        AVIF. Encoded on the server; usually finishes in a second or two. Nothing is stored; the
        file is processed in-memory and returned for download.
      </p>
    </div>

    <div class="glass-card p-6 max-w-2xl mx-auto">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-file" class="text-pink-300" />
        <h2 class="micro-label text-pink-300">Source file</h2>
        <span class="ml-auto text-sm text-night-500 font-mono"> max {{ MAX_FILE_SIZE_MB }}MB </span>
      </div>

      <UFileUpload
        v-if="!selectedFile"
        v-model="fileUploadModel"
        accept="video/mp4,video/webm,video/x-matroska,video/quicktime,image/gif,.mp4,.webm,.mkv,.mov,.gif"
        :interactive="false"
        variant="area"
        layout="list"
        position="outside"
        class="upload-dropzone"
        :ui="{
          base: 'border-0 bg-transparent',
          wrapper: 'flex-col-reverse items-stretch text-left px-0 py-0',
          actions: 'mt-0 w-full justify-center',
        }"
      >
        <template #actions="{ open }">
          <UButton
            icon="i-lucide-cloud-upload"
            label="Choose file"
            color="neutral"
            variant="outline"
            @click="open()"
          />
        </template>
        <template #leading>
          <div class="flex items-center justify-center flex-col py-8 w-full">
            <UIcon name="i-lucide-cloud-upload" class="text-5xl text-night-600 mb-3" />
            <p class="text-night-400 text-sm">Drag and drop a video here</p>
            <p class="text-sm text-night-500 mt-3 font-mono">
              .mp4 .webm .mkv .mov .gif &middot; max {{ MAX_FILE_SIZE_MB }}MB
            </p>
          </div>
        </template>
      </UFileUpload>

      <!-- Selected file preview + action area -->
      <div v-else class="flex flex-col gap-4">
        <div class="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3">
          <div
            class="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center"
          >
            <video
              v-if="previewUrl && selectedFile.type.startsWith('video')"
              :src="previewUrl"
              class="w-full h-full object-cover"
              muted
              preload="metadata"
              playsinline
            />
            <img
              v-else-if="previewUrl"
              :src="previewUrl"
              class="w-full h-full object-cover"
              :alt="selectedFile.name"
            />
            <UIcon v-else name="i-lucide-file" class="text-night-500 text-2xl" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-night-100 truncate" :title="selectedFile.name">
              {{ selectedFile.name }}
            </p>
            <p class="text-xs text-night-500 font-mono mt-0.5">
              {{ formatSize(selectedFile.size) }} &middot; {{ selectedFile.type || 'unknown type' }}
            </p>
          </div>
          <UButton
            icon="i-lucide-x"
            color="error"
            variant="outline"
            square
            class="rounded-full justify-center w-8! h-8! shrink-0"
            :disabled="isConverting"
            aria-label="Clear"
            @click="clearSelection"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="toolFormat" class="text-xs text-night-400 font-medium">Output format</label>
          <USelect
            id="toolFormat"
            v-model="selectedFormat"
            :items="formatOptions"
            :disabled="isConverting"
          />
        </div>

        <UButton
          :label="isConverting ? 'Converting…' : `Convert to ${selectedFormat.toUpperCase()}`"
          icon="i-lucide-zap"
          :loading="isConverting"
          class="search-gradient"
          :disabled="isConverting"
          @click="convert"
        />

        <div v-if="lastResult" class="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5">
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-lucide-circle-check" class="text-emerald-400" />
            <p class="text-xs font-semibold text-emerald-300">
              Conversion complete &mdash; download started
            </p>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono text-night-400">
            <span class="text-night-500">Input:</span>
            <span>{{ formatSize(lastResult.inputSize) }}</span>
            <span class="text-night-500">Output:</span>
            <span class="text-emerald-300">{{ formatSize(lastResult.outputSize) }}</span>
            <span class="text-night-500">Reduction:</span>
            <span>{{ sizeReduction ? `${sizeReduction.percent.toFixed(1)}%` : '—' }}</span>
            <span class="text-night-500">Total time:</span>
            <span>{{ formatDuration(lastResult.durationMs) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
