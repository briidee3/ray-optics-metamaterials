<!--
  Copyright 2026 The Ray Optics Simulation authors and contributors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<template>
  <div class="surface-editor-tools" @click="handleEditorClick">
    <div class="surface-editor-tools-title">
      <span class="surface-editor-tools-title-label">
        {{ $t('simulator:sidebar.seSubTabs.toolsTitle') }}
        <InfoPopoverIcon
          :content="$t('simulator:sidebar.objectList.sceneInfo')"
        />
      </span>
    </div>
    <div class="surface-editor-tools-body">
      <button
        type="button"
        class="surface-editor-tools-move-cam-btn"
        role="button"
        @click="handleMoveCam"
      >
        {{ $t('simulator:sidebar.seSubTabs.moveToObj') }}
      </button>
      <SurfaceEditorList
        :items="items"
        v-model:selectedIds="selectedIds"
        :showAddButton="false"
        :activeId="activeId"
        @remove="handleRemove"
        @duplicate="handleDuplicate"
        @reorder="handleReorder"
        @hover="handleHover"
        @select="handleSelect"
        @selection-change="handleSelectionChange"
        @enable-to="handleToggleTO"
      >
        <template #content="{ item, index }">
          <SceneObjListItemContent :obj="item.obj" :index="index" />
        </template>
      </SurfaceEditorList>
      <p v-if="items.length === 0" class="surface-editor-tools-move-in-hint">
        {{ $t('simulator:sidebar.sceneObjsEditor.emptyHint') }}
      </p>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import i18next from 'i18next'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import SceneObjListItemContent from './SceneObjListItemContent.vue'
import SurfaceEditorList from './SurfaceEditorList.vue'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import { jsonEditorService } from '../../services/jsonEditor'
import { surfaceEditorService } from '../../services/surfaceEditor'

export default {
  name: 'SurfaceEditorTools',
  components: {
    SurfaceEditorList,
    InfoPopoverIcon,
    SceneObjListItemContent
  },
  setup() {
    const sceneStore = useSceneStore()
    const items = computed(() => sceneStore.state.objList)
    const selectedIds = ref([])
    const activeId = ref(null)
    const moduleIds = toRef(sceneStore, 'moduleIds')
    const moduleNames = computed(() => {
      const raw = moduleIds.value ? moduleIds.value.split(',') : []
      return raw.map((name) => name.trim()).filter(Boolean)
    })
    const hasSelection = computed(() => selectedIds.value.length > 0 || activeId.value !== null)

    const setEditorHighlights = (indices) => {
      app.editor?.setExternalHighlightIndices(indices)
      app.simulator?.updateSimulation(true, true)
    }

    const setEditorHover = (index) => {
      app.editor?.setExternalHoverIndex(index)
      app.simulator?.updateSimulation(true, true)
    }

    const handleRemove = (item, index) => {
      sceneStore.removeObj(index)
      selectedIds.value = selectedIds.value.filter((id) => id !== item.id)
    }

    const handleDuplicate = (item, index) => {
      sceneStore.duplicateObj(index)
    }

    // Handle enabling transformation optics functionality
    const handleToggleTO = ( item, index ) => {
      const json = JSON.parse(jsonEditorService.aceEditor.session.getValue())

      if (json.objs[index].toEnabled) {
        json.objs[index].toEnabled = false
      } else {
        json.objs[index].toEnabled = true
      }

      jsonEditorService.updateContent(JSON.stringify(json, null, 2))
      app.syncUrl()
    }

    const handleReorder = ({ fromIndex, toIndex }) => {
      sceneStore.reorderObjs(fromIndex, toIndex)
    }

    const handleHover = ({ index }) => {
      if (typeof index !== 'number' || index < 0) {
        setEditorHover(-1)
        return
      }
      setEditorHover(index)
    }

    const handleSelect = ({ index }) => {
      if (selectedIds.value.length) {
        selectedIds.value = []
        setEditorHighlights([])
      }
      if (typeof index === 'number') {
        app.editor?.selectObj(index)
        
        // Set parameters for NURBS surface definition from the scene JSON, if they exist for the current object index
        // const json = JSON.parse(jsonEditorService.aceEditor.getValue())
        // if (json.objs[index].toSurfaceParams) {
        //   surfaceEditorService.setParams(json.objs[index].toSurfaceParams)
        // } else {
        //   surfaceEditorService.setParams(surfaceEditorService.defaultParams)
        // }

        surfaceEditorService.setLensContext(index)

      }
    }

    const handleMoveCam = () => {
      surfaceEditorService.moveCamToLens()
    }

    const handleSelectionChange = ({ selectedIds: nextSelectedIds }) => {
      const indices = items.value
        .map((item, index) => (nextSelectedIds.includes(item.id) ? index : -1))
        .filter((index) => index >= 0)
      if (indices.length) {
        app.editor?.selectObj(-1)
        activeId.value = null
      }
      setEditorHighlights(indices)
    }

    const handleSceneTabClick = () => {
      if (selectedIds.value.length) {
        selectedIds.value = []
        setEditorHighlights([])
      }
      app.editor?.selectObj(-1)
    }

    const handleEditorClick = (event) => {
      if (event?.target?.closest?.('.sidebar-item-list')) {
        return
      }
      handleSceneTabClick()
    }

    const onMoveToModule = (moduleName) => {
      if (!hasSelection.value) {
        return
      }
      let indices = items.value
        .map((item, index) => (selectedIds.value.includes(item.id) ? index : -1))
        .filter((index) => index >= 0)
      if (!indices.length && activeId.value !== null) {
        const activeIndex = items.value.findIndex((item) => item.id === activeId.value)
        if (activeIndex >= 0) {
          indices = [activeIndex]
        }
      }
      app.scene?.moveObjsToModule?.(indices, moduleName)
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
      selectedIds.value = []
      setEditorHighlights([])
      document.dispatchEvent(new CustomEvent('selectVisualModuleTab', { detail: { moduleName } }))
    }

    const onCreateModule = () => {
      const base = 'NewModule'
      const existing = moduleNames.value
      const suggestNewModuleName = () => {
        if (!existing.includes(base)) return base
        for (let i = 2; i < 10000; i++) {
          const candidate = `${base}${i}`
          if (!existing.includes(candidate)) return candidate
        }
        return `${base}${Date.now()}`
      }
      const defaultName = suggestNewModuleName()
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
      if (existing.includes(newName)) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorNameExists', { name: newName }))
        return
      }
      sceneStore.createModule(newName)
      onMoveToModule(newName)
    }

    const onEditorSelectionChange = (event) => {
      const index = event?.detail?.index ?? -1
      if (selectedIds.value.length) {
        return
      }
      if (index >= 0 && items.value[index]) {
        activeId.value = items.value[index].id
      } else {
        activeId.value = null
      }
    }

    onMounted(() => {
      document.addEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.addEventListener('clearVisualEditorSelection', handleSceneTabClick)
    })

    onUnmounted(() => {
      document.removeEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.removeEventListener('clearVisualEditorSelection', handleSceneTabClick)
    })

    return {
      items,
      selectedIds,
      activeId,
      handleRemove,
      handleDuplicate,
      handleReorder,
      handleHover,
      handleSelect,
      handleSelectionChange,
      handleSceneTabClick,
      handleEditorClick,
      handleToggleTO,
      handleMoveCam,
      moduleNames,
      hasSelection,
      onMoveToModule,
      onCreateModule
    }
  }
}
</script>

<style scoped>
.surface-editor-tools-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.surface-editor-tools-title-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.surface-editor-tools-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.surface-editor-tools-move-btn {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.surface-editor-tools-move-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.surface-editor-tools-module-name {
  font-family: monospace;
}

.surface-editor-tools-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.surface-editor-tools-move-in-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}
</style>


