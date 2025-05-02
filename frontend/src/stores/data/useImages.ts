import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ImageType } from './types/image';

export const useImages = defineStore('images', () => {
  // Define state
  const images = ref<ImageType[]>([]);

  // Return the state and any actions/getters
  return {
    images,
  };
});
