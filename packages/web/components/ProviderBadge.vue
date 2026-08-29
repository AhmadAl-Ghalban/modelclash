<template>
  <span
    class="inline-flex items-center justify-center font-bold shrink-0 rounded"
    :class="[meta(provider).badge, sizeClass]"
    aria-hidden="true"
  >
    {{ initial(provider) }}
  </span>
</template>

<script setup lang="ts">
/**
 * The coloured square carrying a provider's initial.
 *
 * Decorative by design: the provider name is always written out in text next to
 * it, so the badge is hidden from screen readers rather than read as a stray
 * letter.
 */
const props = withDefaults(defineProps<{ provider: string; size?: 'sm' | 'md' }>(), {
  size: 'sm',
})

const { meta, initial } = useProviderMeta()

const sizeClass = computed(() =>
  props.size === 'md' ? 'w-8 h-8 text-xs rounded-lg' : 'w-5 h-5 text-[10px]',
)
</script>
