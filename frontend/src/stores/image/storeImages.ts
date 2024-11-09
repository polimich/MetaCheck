import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Image } from 'src/stores';
import { axios, axiosErrorHandler } from 'src/api/index';

export const useStoreImages = defineStore('images', () => {
  const image = ref<Image>();
  const loading = ref(false);

  const loadImage = async (imageId: string) => {
    loading.value = true;
    try {
      const { data } = await axios.get(`/image/${imageId}`);
      image.value = data;
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    image,
    loadImage,
  };
});
