<script setup lang="ts">
import { ref } from 'vue'

useHead({ title: 'Log in' })

definePageMeta({
  middleware: ['guest'],
})

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const pb = usePocketBase()
const { redirectTarget } = useAuthRedirect()

const email = ref('')
const password = ref('')

const forgotDialogVisible = ref(false)
const forgotEmail = ref('')
const forgotLoading = ref(false)

async function authenticateWithDiscord() {
  try {
    await authStore.loginWithOAuth('discord')
    router.push(redirectTarget())
  } catch (error) {
    console.error('Authentication failed:', error)
    toast.add({
      title: "Couldn't log in",
      description: "Discord login didn't work. Try again.",
      color: 'error',
      duration: 5000,
    })
  }
}

/*
 * X / Twitter OAuth is TEMPORARILY DISABLED — the button is inert and only
 * explains itself. To restore, swap this handler back for the OAuth call:
 *   await authStore.loginWithOAuth('twitter')
 *   router.push(redirectTarget())
 * and drop the `aria-disabled` / muted styling on the button below.
 */
const X_DISABLED_REASON = 'Log in with X is coming soon'

function authenticateWithX() {
  toast.add({
    title: 'Coming soon',
    description: 'Use Discord or email for now.',
    icon: 'i-lucide-clock',
    color: 'info',
    duration: 4000,
  })
}

async function authenticateWithData() {
  try {
    await authStore.login(email.value, password.value)
    router.push(redirectTarget())
  } catch (error) {
    console.error('Authentication failed:', error)
    toast.add({
      title: "Couldn't log in",
      description: 'Check your email and password.',
      color: 'error',
      duration: 5000,
    })
  }
}

async function requestPasswordReset() {
  if (!forgotEmail.value) return
  forgotLoading.value = true
  try {
    await pb.collection('users').requestPasswordReset(forgotEmail.value)
    toast.add({
      title: 'Check your email',
      description: "If there's an account for that email, we've sent a reset link.",
      color: 'success',
      duration: 6000,
    })
    forgotDialogVisible.value = false
    forgotEmail.value = ''
  } catch (error) {
    console.error('Password reset failed:', error)
    toast.add({
      title: "Couldn't send reset link",
      description: 'Try again.',
      color: 'error',
      duration: 5000,
    })
  } finally {
    forgotLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh relative">
    <BackgroundGridMotion />
    <section class="relative z-10 pt-10 md:pt-37.5 flex items-center justify-center">
      <div
        class="bg-gradient-to-br from-night-800 to-night-900 flex flex-col md:flex-row rounded-2xl shadow-lg max-w-3xl w-full mx-4 md:mx-0 overflow-hidden"
      >
        <div class="md:w-1/2 p-5 flex flex-col order-last md:order-first">
          <h2 class="text-2xl text-white font-semibold">Log in</h2>
          <p class="text-sm text-night-400 mt-2">Welcome back</p>
          <form class="mt-6" @submit.prevent="authenticateWithData">
            <div>
              <label for="login-email" class="block text-sm text-night-300">Email</label>
              <UInput
                id="login-email"
                v-model="email"
                type="email"
                name="email"
                autocomplete="email"
                placeholder="Your email"
                class="w-full mt-2"
                :ui="{ base: 'px-4 rounded-lg' }"
                autofocus
                required
              />
            </div>

            <div class="mt-4">
              <div class="flex justify-between items-center">
                <label for="login-password" class="block text-sm text-night-300">Password</label>
                <button
                  type="button"
                  class="text-xs text-night-500 hover:text-night-300 transition-colors duration-200"
                  @click="forgotDialogVisible = true"
                >
                  Forgot password?
                </button>
              </div>
              <UInput
                id="login-password"
                v-model="password"
                type="password"
                name="password"
                autocomplete="current-password"
                placeholder="Your password"
                minlength="6"
                class="w-full mt-2"
                :ui="{ base: 'px-4 rounded-lg' }"
                required
              />
            </div>

            <UButton
              type="submit"
              label="Log in"
              icon="i-lucide-log-in"
              color="neutral"
              variant="solid"
              class="w-full mt-6 !bg-gradient-to-br !from-white !to-zinc-400 !border-0 transition-all duration-200 hover:brightness-95 hover:!to-zinc-500"
            />
          </form>

          <div class="mt-6 grid grid-cols-3 items-center text-night-500">
            <hr class="border-night-700" />
            <p class="text-center text-sm">or</p>
            <hr class="border-night-700" />
          </div>

          <div class="flex gap-3 mt-6">
            <UButton
              icon="i-simple-icons-discord"
              color="info"
              class="flex-1"
              aria-label="Log in with Discord"
              @click="authenticateWithDiscord"
            />
            <!--
              Kept clickable on purpose: a truly `disabled` button swallows
              pointer events, so neither the tooltip nor the "coming soon"
              toast would ever fire. It reads and looks disabled instead, and
              the handler no longer touches OAuth.
            -->
            <UTooltip :text="X_DISABLED_REASON" :content="{ side: 'top' }">
              <UButton
                icon="i-simple-icons-x"
                color="neutral"
                variant="soft"
                class="flex-1 opacity-40 cursor-not-allowed hover:opacity-40"
                aria-label="Log in with X (coming soon)"
                aria-disabled="true"
                @click="authenticateWithX"
              />
            </UTooltip>
          </div>

          <!-- OAuth implicitly registers first-time users, so the consent line
               register.vue shows must appear on this path too. -->
          <p class="text-xs text-night-500 mt-3">
            Logging in with Discord creates an account if you don't have one. You confirm you're 18
            or older and agree to the
            <NuxtLink to="/terms" class="text-pink-400 hover:text-pink-300 transition-colors"
              >Terms</NuxtLink
            >
            and
            <NuxtLink to="/privacy" class="text-pink-400 hover:text-pink-300 transition-colors"
              >Privacy Policy</NuxtLink
            >.
          </p>

          <div
            class="text-sm text-night-400 flex flex-wrap justify-between items-center gap-2 mt-auto pt-4"
          >
            <p>Don't have an account?</p>
            <UButton
              label="Register"
              color="neutral"
              variant="solid"
              class="px-6 font-semibold rounded-lg transition-all duration-200 hover:brightness-95"
              to="/register"
            />
          </div>
        </div>

        <div class="w-full h-48 md:w-1/2 md:h-auto order-first md:order-last">
          <img
            src="~/assets/images/goyangi_login.avif"
            class="w-full h-full object-cover object-center"
            alt=""
          />
        </div>
      </div>
    </section>

    <UModal
      v-model:open="forgotDialogVisible"
      title="Reset password"
      :ui="{ content: 'sm:max-w-sm' }"
    >
      <template #body>
        <p class="text-sm text-night-400 mb-4">Enter your email and we'll send you a reset link.</p>
        <form @submit.prevent="requestPasswordReset">
          <label for="forgot-email" class="block text-sm text-night-300 mb-2">Email</label>
          <UInput
            id="forgot-email"
            v-model="forgotEmail"
            type="email"
            autocomplete="email"
            placeholder="Your email"
            class="w-full"
            autofocus
            required
          />
          <UButton
            type="submit"
            label="Send reset link"
            color="neutral"
            variant="solid"
            :loading="forgotLoading"
            class="w-full mt-4 !bg-gradient-to-br !from-white !to-zinc-400 !border-0 transition-all duration-200 hover:brightness-95"
          />
        </form>
      </template>
    </UModal>
  </div>
</template>
