<template>
  <div class="image-skeleton">
    <div class="skeleton-container">
      <!-- Image placeholder with icon -->
      <div class="placeholder-wrapper">
        <q-skeleton type="rect" class="skeleton-image" animation="pulse" />
        <div class="icon-overlay">
          <q-icon name="image" size="3rem" color="grey-5" />
        </div>
      </div>

      <!-- Message with shimmer effect -->
      <div class="message-container">
        <q-skeleton
          v-if="!message"
          type="text"
          width="100%"
          animation="pulse"
        />
        <div v-else class="message-text">{{ message }}</div>
        <q-skeleton type="text" width="100%" animation="pulse" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  message: {
    type: String,
    default: '',
  },
});
</script>

<style scoped>
.image-skeleton {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-color: #f8f8f8;
  border-radius: 8px;
}

.skeleton-container {
  width: 90%;
  max-width: 500px;
}

.placeholder-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  margin-bottom: 16px;
}

.skeleton-image {
  position: absolute;
  inset: 0;
  border-radius: 8px;
}

.icon-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
}

.message-container {
  text-align: center;
  padding: 8px;
}

.message-text {
  color: #9e9e9e;
  font-size: 1rem;
  margin-bottom: 8px;
  width: 100%;
}
</style>
