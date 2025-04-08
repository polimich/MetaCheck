import { defineStore } from 'pinia';
import { MetaRoleState } from 'src/types/frontend-state/meta_role.state';
import { computed, ref } from 'vue';
import { getMetaRoles } from 'src/api/services';

export const useMetaRoleStore = defineStore('metaRole', () => {
  const metaRoles = ref<MetaRoleState[]>([]);
  const loading = ref(false);
  const error = ref('');

  const metaRoleSelectOptions = computed(() => {
    return metaRoles.value.map((metaRole) => ({
      label: metaRole.display_name,
      value: metaRole.name,
      id: metaRole.id,
      color: metaRole.color,
    }));
  });

  const init = () => {
    loadMetaRoles();
    return;
  };

  const loadMetaRoles = async () => {
    loading.value = true;
    error.value = '';
    try {
      const response = await getMetaRoles();
      if (response.error) {
        error.value = response.error;
        console.error(response.error);
      } else {
        metaRoles.value = response.data;
      }
    } catch (e) {
      error.value = 'Failed to load meta roles';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    metaRoles,
    metaRoleSelectOptions,
    loading,
    error,
    init,
    loadMetaRoles,
  };
});
