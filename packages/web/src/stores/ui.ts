import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type PanelType = 'explorer' | 'build' | 'plugins' | 'themes' | 'git';

export const useUIStore = defineStore('ui', () => {
  // State
  const activePanel = ref<PanelType>('explorer');
  const sidePanelCollapsed = ref(false);
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Computed
  const isMobile = computed(() => windowWidth.value < 768);
  const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1024);
  const isDesktop = computed(() => windowWidth.value >= 1024);

  // Actions
  function setActivePanel(panel: PanelType): void {
    // If clicking the same panel, toggle collapse
    if (activePanel.value === panel && !sidePanelCollapsed.value) {
      sidePanelCollapsed.value = true;
    } else {
      activePanel.value = panel;
      sidePanelCollapsed.value = false;
    }
  }

  function toggleSidePanel(): void {
    sidePanelCollapsed.value = !sidePanelCollapsed.value;
  }

  function collapseSidePanel(): void {
    sidePanelCollapsed.value = true;
  }

  function expandSidePanel(): void {
    sidePanelCollapsed.value = false;
  }

  // Handle window resize
  function handleResize(): void {
    windowWidth.value = window.innerWidth;

    // Auto-collapse on mobile
    if (isMobile.value && !sidePanelCollapsed.value) {
      sidePanelCollapsed.value = true;
    }
  }

  // Lifecycle
  let resizeHandler: (() => void) | null = null;

  function setupResizeListener(): void {
    if (typeof window !== 'undefined') {
      resizeHandler = handleResize;
      window.addEventListener('resize', resizeHandler);
      handleResize(); // Initial check
    }
  }

  function cleanupResizeListener(): void {
    if (typeof window !== 'undefined' && resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
  }

  return {
    // State
    activePanel,
    sidePanelCollapsed,
    windowWidth,

    // Computed
    isMobile,
    isTablet,
    isDesktop,

    // Actions
    setActivePanel,
    toggleSidePanel,
    collapseSidePanel,
    expandSidePanel,
    setupResizeListener,
    cleanupResizeListener,
  };
});
