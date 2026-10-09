<script setup lang="ts">
import { ref } from 'vue'

useHead({ title: 'Register' })

definePageMeta({
  middleware: ['guest'],
})

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { redirectTarget } = useAuthRedirect()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')

async function registerWithData() {
  // Validation
  if (!email.value || !password.value || !passwordConfirm.value) {
    toast.add({
      title: 'Fill in all fields',
      color: 'warning',
      duration: 5000,
    })
    return
  }

  if (password.value.length < 6) {
    toast.add({
      title: 'Password too short',
      description: 'Use at least 6 characters.',
      color: 'warning',
      duration: 5000,
    })
    return
  }

  if (password.value !== passwordConfirm.value) {
    toast.add({
      title: "Passwords don't match",
      color: 'warning',
      duration: 5000,
    })
    return
  }

  try {
    await authStore.register(email.value, password.value, passwordConfirm.value)
    toast.add({
      title: 'Account created',
      color: 'success',
      duration: 3000,
    })
    router.push(redirectTarget())
  } catch (error: any) {
    console.error('Registration failed:', error)
    const errorMessage = error?.response?.data?.message || error?.message || 'Try again.'
    toast.add({
      title: "Couldn't create account",
      description: errorMessage,
      color: 'error',
      duration: 5000,
    })
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
          <h2 class="text-2xl text-white font-semibold">Register</h2>
          <p class="text-sm text-night-400 mt-2">Create a new account</p>
          <form class="mt-6" @submit.prevent="registerWithData">
            <div>
              <label for="register-email" class="block text-sm text-night-300">Email</label>
              <UInput
                id="register-email"
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
              <label for="register-password" class="block text-sm text-night-300">Password</label>
              <UInput
                id="register-password"
                v-model="password"
                type="password"
                name="password"
                autocomplete="new-password"
                placeholder="At least 6 characters"
                minlength="6"
                class="w-full mt-2"
                :ui="{ base: 'px-4 rounded-lg' }"
                required
              />
            </div>

            <div class="mt-4">
              <label for="register-password-confirm" class="block text-sm text-night-300"
                >Confirm password</label
              >
              <UInput
                id="register-password-confirm"
                v-model="passwordConfirm"
                type="password"
                name="passwordConfirm"
                autocomplete="new-password"
                placeholder="Repeat password"
                minlength="6"
                class="w-full mt-2"
                :ui="{ base: 'px-4 rounded-lg' }"
                required
              />
            </div>

            <UButton
              type="submit"
              label="Register"
              icon="i-lucide-user-plus"
              color="neutral"
              variant="solid"
              class="w-full mt-6 !bg-gradient-to-br !from-white !to-zinc-400 !border-0 transition-all duration-200 hover:brightness-95 hover:!to-zinc-500"
            />

            <p class="text-xs text-night-500 mt-3">
              By creating an account, you confirm you're 18 or older and agree to the
              <NuxtLink to="/terms" class="text-pink-400 hover:text-pink-300 transition-colors"
                >Terms</NuxtLink
              >
              and
              <NuxtLink to="/privacy" class="text-pink-400 hover:text-pink-300 transition-colors"
                >Privacy Policy</NuxtLink
              >.
            </p>
          </form>

          <div
            class="text-sm text-night-400 flex flex-wrap justify-between items-center gap-2 mt-auto pt-4"
          >
            <p>Already have an account?</p>
            <UButton
              label="Log in"
              color="neutral"
              variant="solid"
              class="px-6 font-semibold rounded-lg transition-all duration-200 hover:brightness-95"
              to="/login"
            />
          </div>
        </div>

        <div class="w-full h-48 md:w-1/2 md:h-auto order-first md:order-last">
          <img
            src="~/assets/images/goyangi_register.avif"
            class="w-full h-full object-cover object-center"
            alt=""
          />
        </div>
      </div>
    </section>
  </div>
</template>
