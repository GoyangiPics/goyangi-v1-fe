<script setup lang="ts">
import { computed, ref } from 'vue'

useHead({ title: 'Profile' })

definePageMeta({
  middleware: ['auth'],
})

const toast = useToast()
const authStore = useAuthStore()
const confirm = useConfirm()
const router = useRouter()
const avatar = useAvatarUrl()
const pb = usePocketBase()

// ─── User avatar ─────────────────────────────────────────────────────────────
const userAvatarUrl = computed(() => avatar.forUser(authStore.user))
const userAvatarInput = ref<HTMLInputElement | null>(null)
const isUploadingUserAvatar = ref(false)

async function onUserAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  isUploadingUserAvatar.value = true
  try {
    await authStore.updateUserAvatar(file)
    toast.add({ title: 'Photo updated', color: 'success', duration: 2000 })
  } catch {
    toast.add({ title: "Couldn't update photo", color: 'error', duration: 3000 })
  } finally {
    isUploadingUserAvatar.value = false
  }
}

// ─── Uploader ─────────────────────────────────────────────────────────────────
const uploaderName = ref(authStore.uploader?.name ?? '')
const isSavingUploaderName = ref(false)

async function saveUploaderName() {
  if (!uploaderName.value.trim()) return
  isSavingUploaderName.value = true
  try {
    if (authStore.uploader) {
      await authStore.updateUploaderName(uploaderName.value)
    } else {
      await authStore.createUploader(uploaderName.value)
    }
    toast.add({ title: 'Name saved', color: 'success', duration: 2000 })
  } catch {
    toast.add({ title: "Couldn't save name", color: 'error', duration: 3000 })
  } finally {
    isSavingUploaderName.value = false
  }
}

// ─── Data export ──────────────────────────────────────────────────────────────
// GDPR Art. 20 portability, self-service: everything tied to the account, as
// JSON, fetched client-side with the user's own session — every collection
// here is owner-readable by API rule, so no backend endpoint is needed.
const isExporting = ref(false)

async function downloadMyData() {
  if (!authStore.user) return
  isExporting.value = true
  try {
    const own = pb.filter('user={:id}', { id: authStore.user.id })
    const [likes, stars, filters, links, collections, uploads] = await Promise.all([
      pb.collection('users_likes').getFullList({ filter: own }),
      pb.collection('users_stars').getFullList({ filter: own }),
      pb.collection('users_filters').getFullList({ filter: own }),
      pb.collection('users_links').getFullList({ filter: own }),
      pb.collection('contents_collections').getFullList({
        filter: pb.filter('user.id ?= {:id}', { id: authStore.user.id }),
      }),
      // Uploads are credited to the uploader profile, not the user row. Only a
      // reference list — the media files themselves are public content.
      authStore.uploader
        ? pb.collection('contents').getFullList({
            filter: pb.filter('uploader={:id}', { id: authStore.uploader.id }),
            fields: 'id,title,created,date',
          })
        : Promise.resolve([]),
    ])

    // authStore.user is the plain record — the session token lives separately
    // in pb.authStore.token and never enters the export.
    const payload = {
      exportedAt: new Date().toISOString(),
      user: authStore.user,
      uploader: authStore.uploader,
      likes,
      stars,
      filters,
      links,
      collections,
      uploads,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goyangi-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: "Couldn't download your data", color: 'error', duration: 3000 })
  } finally {
    isExporting.value = false
  }
}

// ─── Delete account ───────────────────────────────────────────────────────────
async function confirmDeleteAccount() {
  if (
    await confirm({
      title: 'Delete your account?',
      message:
        'Your account, email, likes, stars, filters and saved links will be deleted. ' +
        'Your posts stay up under an anonymous uploader name. ' +
        "This can't be undone.",
      icon: 'i-lucide-triangle-alert',
      confirmLabel: 'Delete my account',
      cancelLabel: 'Cancel',
      color: 'error',
    })
  ) {
    try {
      await authStore.deleteAccount()
      router.push('/login')
    } catch {
      toast.add({ title: "Couldn't delete account", color: 'error', duration: 3000 })
    }
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto flex flex-col gap-6 mt-6">
    <h1 class="text-2xl font-semibold gradient-text tracking-tight">My profile</h1>

    <!-- Account section -->
    <div class="glass-card p-6 flex flex-col gap-5">
      <h2 class="micro-label text-pink-300">Account</h2>

      <!-- User avatar -->
      <div class="flex items-center gap-4">
        <div
          class="relative w-20 h-20 rounded-full overflow-hidden bg-night-800 border border-white/10 shrink-0 cursor-pointer group"
          @click="userAvatarInput?.click()"
        >
          <img
            v-if="userAvatarUrl"
            :src="userAvatarUrl"
            class="w-full h-full object-cover"
            alt="Your profile photo"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <UIcon name="i-lucide-user" class="text-2xl text-night-400" />
          </div>
          <div
            class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <UIcon name="i-lucide-camera" class="text-white text-lg" />
          </div>
          <div
            v-if="isUploadingUserAvatar"
            class="absolute inset-0 bg-black/60 flex items-center justify-center"
          >
            <UIcon name="i-lucide-loader-circle" class="animate-spin text-white" />
          </div>
        </div>
        <div>
          <p class="text-sm font-medium text-night-200">Profile photo</p>
          <p class="text-xs text-night-500 mt-0.5">JPEG, PNG, WebP or AVIF</p>
          <button
            class="text-xs text-pink-400 hover:text-pink-300 mt-1 cursor-pointer transition-colors"
            :disabled="isUploadingUserAvatar"
            @click="userAvatarInput?.click()"
          >
            Change photo
          </button>
        </div>
        <input
          ref="userAvatarInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          class="hidden"
          @change="onUserAvatarChange"
        />
      </div>

      <USeparator class="my-0!" />

      <!-- Email (read-only) -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-night-400 font-medium">Email</label>
        <UInput :model-value="authStore.user?.email" disabled class="opacity-50" />
      </div>
    </div>

    <!-- Uploader profile section -->
    <div class="glass-card p-6 flex flex-col gap-5">
      <h2 class="micro-label text-pink-300">Uploader</h2>
      <p class="text-xs text-night-500 -mt-2">
        Your name and photo are shown publicly on your posts.
      </p>

      <!-- Uploader display name -->
      <div class="flex flex-col gap-1">
        <label class="text-xs text-night-400 font-medium">Display name</label>
        <div class="flex gap-2">
          <UInput
            v-model="uploaderName"
            placeholder="e.g. nabi"
            class="flex-1"
            @keydown.enter="saveUploaderName"
          />
          <UButton
            label="Save"
            color="success"
            :loading="isSavingUploaderName"
            :disabled="!uploaderName.trim()"
            @click="saveUploaderName"
          />
        </div>
      </div>
    </div>

    <!-- Data export -->
    <div class="glass-card p-6 flex flex-col gap-4">
      <h2 class="micro-label text-pink-300">Your data</h2>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-night-200">Download my data</p>
          <p class="text-xs text-night-500 mt-0.5">
            A JSON file with your account, likes, stars, filters, links, collections and uploads.
          </p>
        </div>
        <UButton
          label="Download"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          class="shrink-0"
          :loading="isExporting"
          @click="downloadMyData"
        />
      </div>
    </div>

    <!-- Danger zone -->
    <div class="glass-card p-6 flex flex-col gap-4 border-red-500/20!">
      <h2 class="micro-label text-red-400">Danger zone</h2>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-night-200">Delete account</p>
          <p class="text-xs text-night-500 mt-0.5">
            Removes your account and personal data. Your posts stay up, credited anonymously.
          </p>
        </div>
        <UButton
          label="Delete"
          color="error"
          variant="outline"
          class="shrink-0"
          @click="confirmDeleteAccount"
        />
      </div>
    </div>
  </div>
</template>
