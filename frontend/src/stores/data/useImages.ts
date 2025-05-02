import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ImageType } from './types/image';

export const useImages = defineStore('images', () => {
  const images = ref<ImageType[]>([]);
  return {};
});
