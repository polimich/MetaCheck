<script setup lang="ts">
defineProps({
  order: {
    type: Number,
    required: true,
  },
  isActive: {
    type: Boolean,
    required: true,
  },
});
</script>

<template>
  <div class="order-badge">
    <q-badge color="primary" class="order-number">
      {{ order }}
      <q-tooltip>Page order: {{ order }}</q-tooltip>
    </q-badge>
  </div>
</template>

<style lang="scss" scoped>
.order-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;

  .order-number {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    padding: 4px 8px;
    border-radius: 12px;

    &:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  }
}

// Ensure contrast for order badge in active thumbnail
:deep(.thumbnail-active) .order-badge {
  .order-number {
    background-color: white !important;
    color: var(--q-primary) !important;
    font-weight: 700;
  }
}
</style>
