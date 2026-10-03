<script setup lang="ts">
import { ref } from 'vue'

useHead({ title: 'Reset Password' })

const router = useRouter()
const route = useRoute()
const toast = useToast()
const pb = usePocketBase()

const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)

const token = computed(() => (route.query.token as string) || '')
const hasToken = computed(() => token.value.length > 0)

async function confirmReset() {
  if (!hasToken.value) {
    toast.add({
      title: 'Invalid link',
      description: 'This reset link is missing its token. Request a new one from the login page.',
      color: 'error',
      duration: 5000,
    })
    return
  }
  if (password.value !== passwordConfirm.value) {
    toast.add({
      title: 'Validation Error',
      description: 'Passwords do not match.',
      color: 'warning',
      duration: 5000,
    })
    return
  }
  loading.value = true
  try {
    await pb
      .collection('users')
      .confirmPasswordReset(token.value, password.value, passwordConfirm.value)
    toast.add({
      title: 'Password Reset',
      description: 'Your password has been updated. Please log in.',
      color: 'success',
      duration: 5000,
    })
    router.push('/login')
  } catch (error) {
    console.error('Password reset failed:', error)
    toast.add({
      title: 'Reset Failed',
      description: 'The reset link is invalid or has expired.',
      color: 'error',
      duration: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh">
    <section class="pt-10 md:pt-37.5 flex items-center justify-center">
      <div
        class="bg-gradient-to-br from-night-800 to-night-900 rounded-2xl shadow-lg w-full max-w-sm mx-4 p-8"
      >
        <h2 class="text-2xl text-white font-semibold">Reset Password</h2>
        <p class="text-sm text-night-400 mt-2">Enter your new password below.</p>

        <UAlert
          v-if="!hasToken"
          color="error"
          variant="subtle"
          class="mt-4"
          description="This reset link is missing its token. Request a new one from the login page."
        />

        <form class="mt-6" @submit.prevent="confirmReset">
          <div>
            <label for="new-password" class="block text-sm text-night-300">New Password</label>
            <UInput
              id="new-password"
              v-model="password"
              type="password"
              name="password"
              autocomplete="new-password"
              placeholder="Enter new password"
              minlength="6"
              class="w-full mt-2"
              autofocus
              required
            />
          </div>

          <div class="mt-4">
            <label for="confirm-new-password" class="block text-sm text-night-300"
              >Confirm Password</label
            >
            <UInput
              id="confirm-new-password"
              v-model="passwordConfirm"
              type="password"
              name="passwordConfirm"
              autocomplete="new-password"
              placeholder="Confirm new password"
              minlength="6"
              class="w-full mt-2"
              required
            />
          </div>

          <UButton
            type="submit"
            label="Set New Password"
            icon="i-lucide-lock"
            color="neutral"
            variant="solid"
            :loading="loading"
            :disabled="!hasToken"
            class="w-full mt-6 !bg-gradient-to-br !from-white !to-zinc-400 !border-0 transition-all duration-200 hover:brightness-95 hover:!to-zinc-500"
          />
        </form>

        <div class="text-sm text-night-400 mt-6 text-center">
          <NuxtLink to="/login" class="hover:text-night-200 transition-colors duration-200">
            Back to login
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
