import { defineStore } from 'pinia';
import { DetectionType } from 'src/stores';
import { computed, ref } from 'vue';
import { axios, axiosErrorHandler } from 'src/api';

export const useDetectionTypesStore = defineStore('detectionTypes', () => {
  const detectionTypes = ref<DetectionType[]>([]);
  const detectionTypesSelectOptions = computed(() => {
    return detectionTypes.value.map((dt) => ({
      value: dt.name,
      label: dt.display_name,
      id: dt.id,
    }));
  });

  const loading = ref(false);

  const init = async () => {
    await loadDetectionTypes();
  };

  const loadDetectionTypes = async () => {
    loading.value = true;
    try {
      const { data } = await axios.get('/detection_type');
      detectionTypes.value = data;
    } catch (e) {
      axiosErrorHandler(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    detectionTypes,
    detectionTypesSelectOptions,
    loading,
    init,
    loadDetectionTypes,
  };
});
