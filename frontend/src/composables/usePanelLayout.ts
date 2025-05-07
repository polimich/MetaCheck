import { ref, computed } from 'vue';

export const usePanelLayout = () => {
  // Panel collapse and resize state
  const leftPanelCollapsed = ref(false);
  const rightPanelCollapsed = ref(false);
  const annotationPanelCollapsed = ref(false);
  const leftPanelWidth = ref(25); // Initial width in percentage
  const rightPanelWidth = ref(33); // Initial width in percentage
  const structurePanelHeight = ref(35); // Initial height in percentage
  const isDraggingLeft = ref(false);
  const isDraggingRight = ref(false);
  const isDraggingStructure = ref(false);
  const startX = ref(0);
  const startY = ref(0);
  const startLeftWidth = ref(0);
  const startRightWidth = ref(0);
  const startStructureHeight = ref(0);

  // Computed styles for the panels
  const leftColumnStyle = computed(() => {
    return leftPanelCollapsed.value
      ? { width: '40px', minWidth: '40px', flex: '0 0 40px' }
      : {
          width: `${leftPanelWidth.value}%`,
          flex: `0 0 ${leftPanelWidth.value}%`,
        };
  });

  const rightColumnStyle = computed(() => {
    return rightPanelCollapsed.value
      ? { width: '40px', minWidth: '40px', flex: '0 0 40px' }
      : {
          width: `${rightPanelWidth.value}%`,
          flex: `0 0 ${rightPanelWidth.value}%`,
        };
  });

  const middleColumnStyle = computed(() => {
    const remainingWidth =
      100 -
      (leftPanelCollapsed.value
        ? (40 / window.innerWidth) * 100
        : leftPanelWidth.value) -
      (rightPanelCollapsed.value
        ? (40 / window.innerWidth) * 100
        : rightPanelWidth.value);
    return { width: `${remainingWidth}%`, flex: `1 1 ${remainingWidth}%` };
  });

  const structureSectionStyle = computed(() => {
    if (annotationPanelCollapsed.value) {
      // When annotation panel is collapsed, structure takes all remaining space
      return {
        flex: '1 1 auto',
        height: 'auto',
      };
    } else {
      // When both panels are visible, use the user-defined height
      return {
        height: `${structurePanelHeight.value}%`,
        flex: `0 0 ${structurePanelHeight.value}%`,
      };
    }
  });

  const annotationSectionStyle = computed(() => {
    if (annotationPanelCollapsed.value) {
      // Minimal height collapsed state
      return {
        height: '36px',
        minHeight: '36px',
        flex: '0 0 36px',
        overflow: 'hidden',
      };
    } else {
      // Take all space not used by structure panel
      const remainingHeight = 100 - structurePanelHeight.value;
      return {
        height: `${remainingHeight}%`,
        flex: `1 1 ${remainingHeight}%`,
        overflow: 'auto',
      };
    }
  });

  // Panel collapse toggle functions
  const toggleLeftPanel = () => {
    leftPanelCollapsed.value = !leftPanelCollapsed.value;
  };

  const toggleRightPanel = () => {
    rightPanelCollapsed.value = !rightPanelCollapsed.value;
  };

  const toggleAnnotationPanel = () => {
    annotationPanelCollapsed.value = !annotationPanelCollapsed.value;
  };

  // Panel resize functions
  const startLeftDrag = (e: MouseEvent) => {
    isDraggingLeft.value = true;
    startX.value = e.clientX;
    startLeftWidth.value = leftPanelWidth.value;
    document.addEventListener('mousemove', handleLeftDrag);
    document.addEventListener('mouseup', stopLeftDrag);
  };

  const handleLeftDrag = (e: MouseEvent) => {
    if (!isDraggingLeft.value) return;
    const deltaX = e.clientX - startX.value;
    const container = document.querySelector('.app-container') as HTMLElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const newWidth = startLeftWidth.value + (deltaX / containerWidth) * 100;

    // Constrain width between 10% and 50%
    leftPanelWidth.value = Math.max(10, Math.min(50, newWidth));
  };

  const stopLeftDrag = () => {
    isDraggingLeft.value = false;
    document.removeEventListener('mousemove', handleLeftDrag);
    document.removeEventListener('mouseup', stopLeftDrag);
  };

  const startRightDrag = (e: MouseEvent) => {
    isDraggingRight.value = true;
    startX.value = e.clientX;
    startRightWidth.value = rightPanelWidth.value;
    document.addEventListener('mousemove', handleRightDrag);
    document.addEventListener('mouseup', stopRightDrag);
  };

  const handleRightDrag = (e: MouseEvent) => {
    if (!isDraggingRight.value) return;
    const deltaX = startX.value - e.clientX;
    const container = document.querySelector('.app-container') as HTMLElement;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const newWidth = startRightWidth.value + (deltaX / containerWidth) * 100;

    // Constrain width between 10% and 50%
    rightPanelWidth.value = Math.max(10, Math.min(50, newWidth));
  };

  const stopRightDrag = () => {
    isDraggingRight.value = false;
    document.removeEventListener('mousemove', handleRightDrag);
    document.removeEventListener('mouseup', stopRightDrag);
  };

  const startStructureDrag = (e: MouseEvent) => {
    isDraggingStructure.value = true;
    startY.value = e.clientY;
    startStructureHeight.value = structurePanelHeight.value;
    document.addEventListener('mousemove', handleStructureDrag);
    document.addEventListener('mouseup', stopStructureDrag);
  };

  const handleStructureDrag = (e: MouseEvent) => {
    if (!isDraggingStructure.value) return;
    const deltaY = e.clientY - startY.value;
    const rightPanel = document.querySelector(
      '.right-column .column-content',
    ) as HTMLElement;
    if (!rightPanel) return;
    const rightPanelHeight = rightPanel.clientHeight;
    const newHeight =
      startStructureHeight.value + (deltaY / rightPanelHeight) * 100;

    // Allow any height from 5% to 95%
    structurePanelHeight.value = Math.max(5, Math.min(95, newHeight));
  };

  const stopStructureDrag = () => {
    isDraggingStructure.value = false;
    document.removeEventListener('mousemove', handleStructureDrag);
    document.removeEventListener('mouseup', stopStructureDrag);
  };

  return {
    // State
    leftPanelCollapsed,
    rightPanelCollapsed,
    annotationPanelCollapsed,

    // Computed styles
    leftColumnStyle,
    rightColumnStyle,
    middleColumnStyle,
    structureSectionStyle,
    annotationSectionStyle,

    // Toggle functions
    toggleLeftPanel,
    toggleRightPanel,
    toggleAnnotationPanel,

    // Drag handlers
    startLeftDrag,
    startRightDrag,
    startStructureDrag,
  };
};
