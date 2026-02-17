<template>
  <div class="se-tab">
    <div class="se-subtabs" role="tablist" aria-label="Surface Editor Tabs">
      <button
        type="button"
        class="se-subtab is-scene"
        :class="{ active: activeTabId === 'scene' }"
        role="tab"
        :aria-selected="activeTabId === 'scene'"
        @click="activeTabId = 'scene'"
      >
        {{ $t('simulator:sidebar.seSubTabs.scene') }}
      </button>
      <button
        type="button"
        class="se-subtab is-surfaceEditor"
        :class="{ active: activeTabId === 'surfaceEditor' }"
        role="tab"
        :aria-selected="activeTabId === 'surfaceEditor'"
        @click="activeTabId = 'surfaceEditor'"
      >
        {{ $t('simulator:sidebar.seSubTabs.surfaceEditor') }}
      </button>
    </div>
    <div class="se-subtab-content" role="tabpanel" @click="handleContentClick">
      <SceneObjsEditor v-if="activeTabId === 'scene'" />
      <SurfaceEditor v-else/>
      <!-- ="activeTabId === 'surfaceEditor'" /> -->
      <!-- <canvas class="surfaceEditorContainer"></canvas>> -->
    </div>
    <div class="se-tab-title">Surface Editor</div>
    <div class="sidebar-tab-placeholder-body">
      Placeholder UI (coming soon).
    </div>
  </div>
</template>

<script>
/*
TODO:
- add button to open or close surface editor
- add JSON editor for surface json in surface editor
*/
// import SurfaceEditor from '../SurfaceEditor.vue';
// import { surfaceEditorService } from '../../services/surfaceEditor';
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import i18next from 'i18next'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import SceneObjsEditor from './SceneObjsEditor.vue'
import ModuleEditor from './ModuleEditor.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import SurfaceEditor from '../SurfaceEditor.vue'
import { usePreferencesStore } from '../../store/preferences'

export default {
  name: 'SurfaceEditorTab',
  components: { SceneObjsEditor, ModuleEditor, InfoPopoverIcon, SurfaceEditor },
  setup() {
    const preferences = usePreferencesStore()
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')
    const showSurfaceEditor = toRef(preferences, 'showSurfaceEditor')

    const moduleNames = computed(() => {
      const raw = moduleIds.value ? moduleIds.value.split(',') : []
      return raw.map(s => s.trim()).filter(Boolean)
    })

    // NOTE: kept local per request (no store binding)
    const activeTabId = ref('scene')

    const suggestNewModuleName = (names) => {
      const base = 'NewModule'
      if (!names.includes(base)) return base
      for (let i = 2; i < 10000; i++) {
        const candidate = `${base}${i}`
        if (!names.includes(candidate)) return candidate
      }
      // Extremely unlikely, but keep the UI unblocked.
      return `${base}${Date.now()}`
    }

    const onCreateModuleClick = () => {
      const defaultName = suggestNewModuleName(moduleNames.value)
      const proposed = window.prompt(i18next.t('simulator:sidebar.moduleEditor.promptNewName'), defaultName)
      if (proposed == null) return

      const newName = proposed.trim()
      if (!newName) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorEmptyName'))
        return
      }
      if (newName.includes(',')) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorComma'))
        return
      }
      if (moduleNames.value.includes(newName)) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorNameExists', { name: newName }))
        return
      }

      scene.createModule(newName)
      activeTabId.value = `module:${newName}`
    }

    const handleSelectModuleTab = (event) => {
      const moduleName = event?.detail?.moduleName
      if (moduleName) {
        activeTabId.value = `module:${moduleName}`
      }
    }

    const handleSelectSceneTab = () => {
      activeTabId.value = 'scene'
      hideSurfaceEditor()
    }

    const handleSelectEditorTab = () => {
      activeTabId.value = 'surfaceEditor'
      revealSurfaceEditor()
    }

    const hideSurfaceEditor = () => {
      showSurfaceEditor.value = false
    }

    const revealSurfaceEditor = () => {
      showSurfaceEditor.value = true

      // Handle resizing scene if sidebar was resized since it was last open
      // setTimeout(() => {
      //   if (jsonEditorService.aceEditor) {
      //     jsonEditorService.aceEditor.resize()
      //   }
      // }, 350)
    }

    const handleContentClick = (event) => {
      if (event?.target?.closest?.('.sidebar-item-list') || event?.target?.closest?.('.scene-objs-editor-actions')) {
        return
      }
      document.dispatchEvent(new CustomEvent('clearVisualEditorSelection'))
    }

    // If the selected module disappears, fall back to Scene.
    watch(moduleNames, (names) => {
      if (activeTabId.value === 'scene') return
      const currentModule = activeTabId.value.startsWith('module:') ? activeTabId.value.slice('module:'.length) : ''
      if (!names.includes(currentModule)) {
        activeTabId.value = 'scene'
      }
    })

    onMounted(() => {
      // document.addEventListener('selectVisualModuleTab', handleSelectModuleTab)
      document.addEventListener('selectSeSceneTab', handleSelectSceneTab)
      document.addEventListener('selectSeEditorTab', handleSelectEditorTab)

      if (activeTabId.value === 'surfaceEditor') { revealSurfaceEditor() }
    })

    onUnmounted(() => {
      // document.removeEventListener('selectVisualModuleTab', handleSelectModuleTab)
      hideSurfaceEditor()

      document.removeEventListener('selectSeSceneTab', handleSelectSceneTab)
      document.removeEventListener('selectSeEditorTab', handleSelectEditorTab)
    })

    watch(activeTabId, (nextValue) => {
      if (nextValue === 'scene') {
        app.editor?.selectObj(-1)
      }
    })

    return {
      activeTabId,
      moduleNames,
      onCreateModuleClick,
      handleContentClick
    }
  }
}
</script>

<style scoped>
.se-tab {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.se-subtabs {
  display: flex;
  gap: 4px;
  padding: 10px 8px 0 8px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  flex-shrink: 0;
}

.se-subtabs::-webkit-scrollbar {
  height: 8px;
}

.se-subtabs::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
}

.se-subtabs::-webkit-scrollbar-track {
  background: transparent;
}

.se-create-module {
  margin-left: auto; /* right-align when tabs fit; scrolls with tabs when overflow */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.se-subtab {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-bottom: none;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  padding: 2px 12px; /* thinner tabs */
  height: 22px;
  display: flex;
  align-items: center;
  line-height: 1.1;
  border-radius: 0; /* trapezoid tabs */
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
  flex: 0 0 auto;
  margin-bottom: -1px; /* sely connects active tab to content panel */
  /* trapezoid shape (angled sides) */
  clip-path: polygon(10px 0%, calc(100% - 10px) 0%, 100% 100%, 0% 100%);
  position: relative;
  z-index: 1;
}

.se-subtab + .se-subtab {
  margin-left: -6px; /* slight overlap between trapezoids */
}

.se-subtab.is-module {
  font-family: monospace;
}

.se-subtab.is-create-module {
  clip-path: none; /* not a trapezoid */
  border: none; /* no border for the new module button */
  background: transparent;
  padding-left: 5px;
  padding-right: 5px;
}

.se-subtab:hover {
  background: rgba(60, 65, 70, 0.32);
  color: rgba(255, 255, 255, 0.82);
  z-index: 2;
}

.se-subtab.is-create-module:hover {
  border: none;
}

.se-subtab.active {
  background: rgba(80, 85, 90, 0.5);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.12);
  z-index: 3;
}

.se-subtab:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.se-subtab-content {
  flex-grow: 1;
  min-height: 0;
  padding: 12px;
  background: rgba(80, 85, 90, 0.5); /* same as active tab, but dim */
  overflow: auto;
}
</style>



