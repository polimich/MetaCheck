// @author Michael Polívka (xpoliv07)
import { defineStore } from 'pinia';
import { MetaRoleState } from 'src/types/frontend-state/meta_role.state';
import { ref, computed } from 'vue';
import { getMetaRoles } from 'src/api/services';

// Constants
const STORAGE_KEY = 'meta-role-store';

export const useMetaRoleStore = defineStore('metaRole', () => {
  const metaRoles = ref<MetaRoleState[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref('');

  // Maps computed_name to id for meta roles
  const metaRoleIdByName = computed(() => {
    const map = new Map<string, string>();

    metaRoles.value.forEach((role) => {
      if (role.computed_name) {
        map.set(role.computed_name, role.id);
      }
    });

    return map;
  });

  const getAllMetaRoleSelectOptions = computed(() => {
    return metaRoles.value.map((role) => ({
      label: role.computed_display_name,
      value: role.computed_name,
    }));
  });

  // Function to get the id by computed_name
  const getIdByComputedName = (computedName: string): string | undefined => {
    return metaRoleIdByName.value.get(computedName);
  };

  const init = () => {
    // Try to restore from localStorage
    try {
      const storedRoles = localStorage.getItem(STORAGE_KEY);
      if (storedRoles) {
        const parsedRoles = JSON.parse(storedRoles);
        if (Array.isArray(parsedRoles) && parsedRoles.length > 0) {
          metaRoles.value = parsedRoles;
          loaded.value = true;
          return;
        }
      }
    } catch (e) {
      console.error('Error restoring meta roles from localStorage:', e);
    }

    // If no stored data, load from API
    loadMetaRoles();
    return;
  };

  // Persist state to localStorage
  const persistState = () => {
    if (metaRoles.value.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(metaRoles.value));
      } catch (e) {
        console.error('Error persisting meta role state:', e);
      }
    }
  };

  const loadMetaRoles = async () => {
    if (loaded.value && metaRoles.value.length > 0) {
      return;
    }

    loading.value = true;
    error.value = '';
    try {
      const response = await getMetaRoles();
      if (response.error) {
        error.value = response.error;
        console.error(response.error);
      } else {
        metaRoles.value = response.data;
        loaded.value = true;
        persistState();
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
    getAllMetaRoleSelectOptions,
    getIdByComputedName,
    loading,
    loaded,
    error,
    init,
    loadMetaRoles,
  };
});
