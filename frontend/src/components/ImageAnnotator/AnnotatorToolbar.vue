<script setup lang="ts">
// @author Michael Polívka (xpoliv07)
import type { NavigationModeType } from './composables/useNavigationMode';

// Props for actions and state passed from the parent
defineProps<{
  save: () => void;
  undo: () => void;
  redo: () => void;
  setMode: (mode: NavigationModeType) => void;
  resetView: () => void;
  currentMode: NavigationModeType;
  undoStackLength: number | undefined;
  redoStackLength: number | undefined;
  zoomPercentage: number | undefined;
  isSaving?: boolean; // New prop to show saving indicator
}>();
</script>

<template>
  <div class="control-panel q-pa-sm q-gutter-y-sm">
    <q-btn
      @click="save"
      icon="save"
      color="primary"
      flat
      dense
      size="md"
      class="toolbar-btn"
      title="Save (Ctrl+S)"
      :loading="isSaving"
    />
    <q-btn
      @click="undo"
      icon="undo"
      color="grey-7"
      flat
      dense
      size="md"
      :disable="!undoStackLength || undoStackLength === 0"
      class="toolbar-btn"
      title="Undo (Ctrl+Z)"
    />
    <q-btn
      @click="redo"
      icon="redo"
      color="grey-7"
      flat
      dense
      size="md"
      :disable="!redoStackLength || redoStackLength === 0"
      class="toolbar-btn"
      title="Redo (Ctrl+Y)"
    />

    <!-- Custom vertical toggle buttons -->
    <div class="custom-toggle">
      <q-btn
        @click="setMode('add')"
        icon="edit"
        :color="currentMode === 'add' ? 'accent' : 'grey-7'"
        flat
        dense
        size="md"
        class="toggle-btn toggle-top"
        title="Draw (W)"
      />
      <q-btn
        @click="setMode('drag')"
        icon="pan_tool"
        :color="currentMode === 'drag' ? 'accent' : 'grey-7'"
        flat
        dense
        size="md"
        class="toggle-btn toggle-bottom"
        title="Pan (E)"
      />
    </div>

    <q-btn
      @click="resetView"
      icon="zoom_out_map"
      color="grey-7"
      flat
      dense
      size="md"
      class="toolbar-btn"
      title="Reset View (Z)"
    />
    <div class="zoom-indicator q-pa-xs text-center">
      {{ zoomPercentage || 100 }}%
    </div>
    <q-btn
      icon="help_outline"
      flat
      dense
      size="md"
      color="grey-7"
      class="toolbar-btn"
      title="Help"
    >
      <q-menu anchor="bottom left" self="top left">
        <q-list dense style="min-width: 200px">
          <q-item-label header>Keyboard Shortcuts</q-item-label>
          <q-item>
            <q-item-section>
              <q-item-label>Ctrl+S</q-item-label>
            </q-item-section>
            <q-item-section>Save</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Ctrl+Z</q-item-label>
            </q-item-section>
            <q-item-section>Undo</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Ctrl+Y or Ctrl+Shift+Z</q-item-label>
            </q-item-section>
            <q-item-section>Redo</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>W</q-item-label>
            </q-item-section>
            <q-item-section>Drawing Mode</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>E</q-item-label>
            </q-item-section>
            <q-item-section>Pan Mode</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Z</q-item-label>
            </q-item-section>
            <q-item-section>Reset View</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Space</q-item-label>
            </q-item-section>
            <q-item-section>Temporary Pan Mode (while held)</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Delete/Backspace</q-item-label>
            </q-item-section>
            <q-item-section>Delete Selected</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Alt+Scroll</q-item-label>
            </q-item-section>
            <q-item-section>Zoom</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<style scoped>
.control-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  bottom: auto;
  left: auto;
  z-index: 1000;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  width: auto;
  align-items: center;
}

/* Styling for individual toolbar buttons */
.toolbar-btn {
  width: 100%; /* Make buttons fill panel width */
  border-radius: 4px !important; /* Consistent rounded corners */
  margin: 2px 0 !important; /* Add slight vertical margin */
  border: 1px solid rgba(0, 0, 0, 0.1) !important; /* Subtle border */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); /* Subtle shadow */
}

/* Custom toggle button group */
.custom-toggle {
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
  margin: 2px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.1) !important; /* Border around the group */
}

.toggle-btn {
  border-radius: 0 !important;
  margin: 0 !important;
  width: 100%;
  border: none !important; /* Remove individual borders, rely on group border */
}

.toggle-btn.toggle-top {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important; /* Border between buttons */
}

.toggle-btn.toggle-bottom {
  /* No special style needed */
}

.zoom-indicator {
  font-size: 0.9em;
  color: #333;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 2px 6px;
  border-radius: 3px;
  width: 100%;
}
</style>
