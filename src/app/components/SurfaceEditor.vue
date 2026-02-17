<!--
  Copyright 2025 The Ray Optics Simulation authors and contributors

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
  <div id="surface-editor" :class="{ 'se-visible': showSurfaceEditor }" :style="{ width: seWidth + 'px' }" :data-width="seWidth">
    <div id="seMobileHeightDiff" class="d-none d-lg-block se-mobile-height-diff"></div>
    <!-- <div id="surfaceEditorContainer">
      <div class="se-tabs" role="tablist" aria-label="Surface Editor tabs">
        <div class="sidebar-tabs-left">
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: activeTab === 'visual' }"
            role="tab"
            :aria-selected="activeTab === 'visual'"
            @click="setActiveTab('visual')"
          >
            {{ $t('simulator:sidebar.tabs.visual') }}<sup>Beta</sup>
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: activeTab === 'code' }"
            role="tab"
            :aria-selected="activeTab === 'code'"
            @click="setActiveTab('code')"
          >
            {{ $t('simulator:sidebar.tabs.code') }}
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: activeTab === 'ai' }"
            role="tab"
            :aria-selected="activeTab === 'ai'"
            @click="setActiveTab('ai')"
          >
            {{ $t('simulator:sidebar.tabs.ai') }}
          </button>
        </div>

        <button
          type="button"
          class="sidebar-collapse-btn"
          aria-label="Hide sidebar"
          @click.stop="hideSidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M12 2.8L7.2 8 12 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7.2 2.8L2.4 8 7.2 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div> -->

      <!-- <div class="sidebar-tab-content">
        <VisualTab v-if="showSidebar && activeTab === 'visual'" />
        <div id="jsonEditor" v-show="activeTab === 'code'"></div>
        <AITab v-show="activeTab === 'ai'" />
      </div>
    </div> -->
    <!-- <canvas ref="surfaceEditorContainer" id="surfaceEditorContainer"></canvas> -->
    <canvas ref="canvas" id="surfaceEditorCanvas"></canvas>
    <div 
      class="resize-handle"
      @mousedown="startResize"
      @touchstart="startResize"
    ></div>
  </div>

  <!-- Hidden state hover region -->
  <div
    class="drawer-hover-region"
    :class="{ 'drawer-hover-region-active': !showSidebar }"
  >
    <div class="d-none d-lg-block sidebar-mobile-height-diff"></div>
    <button
      type="button"
      class="drawer-toggle-expand"
      aria-label="Show surface editor"
      @click="expandSurfaceEditor"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.8L8.8 8 4 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.8 2.8L13.6 8 8.8 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script>
/**
 * @module SurfaceEditor
 * @description The Vue component for the NURBS surface editor for use defining GRIN fields.
 */
import { usePreferencesStore } from '../store/preferences'
import { toRef, ref, toRaw, markRaw, onMounted, onUnmounted, nextTick, watch, useTemplateRef } from 'vue'
// import { jsonEditorService } from '../services/jsonEditor'
// import { surfaceEditorService } from '../services/surfaceEditor'
// import VisualTab from './sidebar/VisualTab.vue'
// import AITab from './sidebar/AITab.vue'
import BasicScene from '../components/nurbs-editor/src/utils/BasicScene'
import SurfaceObject from '../components/nurbs-editor/src/utils/NURBSSurface'
import * as THREE from 'three'

export default {
  name: 'SurfaceEditor',
  // components: { VisualTab, AITab },
  components: { },
  setup(props, { expose }) {
    // if (this.basicScene) return

    // const canvas = document.querySelector("#surfaceEditorContainer")
    // const canvas = document.getElementById("surfaceEditorContainer")
    // console.log(canvas)
    // const surfaceEditorDiv = ref(null)
    // onMounted(() => {
    //   // Add keyboard event listeners to prevent propagation from JSON editor
    //   const jsonEditor = document.getElementById('jsonEditor')
      
    //   if (jsonEditor) {
    //     jsonEditor.addEventListener('keydown', handleKeyboardEvent, false)
    //     jsonEditor.addEventListener('keyup', handleKeyboardEvent, false)
    //     jsonEditor.addEventListener('keypress', handleKeyboardEvent, false)
    //   }
    // })
    
    // onUnmounted(() => {
    //   // Clean up event listeners if component is destroyed during resize
    //   document.removeEventListener('mousemove', handleResize)
    //   document.removeEventListener('mouseup', stopResize)
    //   document.removeEventListener('touchmove', handleResize)
    //   document.removeEventListener('touchend', stopResize)
      
    //   // Clean up keyboard event listeners
    //   const jsonEditor = document.getElementById('jsonEditor')
      
    //   if (jsonEditor) {
    //     jsonEditor.removeEventListener('keydown', handleKeyboardEvent, false)
    //     jsonEditor.removeEventListener('keyup', handleKeyboardEvent, false)
    //     jsonEditor.removeEventListener('keypress', handleKeyboardEvent, false)
    //   }
    // })


    const preferences = usePreferencesStore()
    const seWidth = toRef(preferences, 'seWidth')
    const showSurfaceEditor = toRef(preferences, 'showSurfaceEditor')
    const activeTab = toRef(preferences, 'seTab')
    
    const isResizing = ref(false)
    const startX = ref(0)
    const startWidth = ref(0)

    // // const basicScene = null
    // const canvas = document.createElement('canvas')
    // canvas.setAttribute('ref', 'canvas')
    // canvas.setAttribute('id', 'surfaceEditorCanvas')

    // onMounted(() => {
    //   document.getElementById('surface-editor').appendChild(canvas)
    // })
    // // const canvas = ref(null)//document.getElementById("surfaceEditorContainer")

    // // Initialize the scene for the first time if it doesn't already exist
    // // if (typeof this.basicScene === 'undefined' || this.basicScene === null) {
    // //   console.log("in setup")
    // //   initializeScene()
    // // }

    // // Set up everything in the scene
    // // const initializeScene = () => {
    //   // this.canvas = useTemplateRef("surfaceEditorContainer")
    //   // this.canvas = this.$refs.canvas
    //   // const canvas = ref(null)
      
    //   // const canvas = ref(null)


    // console.log("canvas", canvas)
    // const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas })
    // const scene = new THREE.Scene()
    // const basicScene = new BasicScene({ dimension: 2, objects: [], canvas: canvas, renderer: renderer, scene: scene}) // assuming basicScene already initialized to null

    // basicScene.sceneObjects.camera.position.z = 1000;

    // const nurbsObjs = []
    // nurbsObjs.push(new SurfaceObject({ threeScene: basicScene, texturePath: '../components/nurbs-editor/img/uv_grid_opengl.jpg' }))
    // basicScene.addObject(nurbsObjs[0].nurbsObj)

    // const grid = new THREE.GridHelper(10000, 250)
    // grid.rotation.x = Math.PI * 0.5
    // grid.position.z = -1.1
    // basicScene.addObject(grid)
    // }
    // initializeScene()

    // Allow access to these objects from outside of SurfaceEditor instances
    // expose({ canvas: canvas, basicScene: basicScene })
    // console.log(canvas)
    
    // Keyboard event handler to prevent propagation
    const handleKeyboardEvent = (e) => {
      // Stop the event from propagating to the body
      e.stopPropagation()
    }
    
    const startResize = (e) => {
      e.preventDefault() // Prevent default touch behavior
      const initialWidth = seWidth.value
      isResizing.value = true
      
      // Handle both mouse and touch events
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
      startX.value = clientX
      startWidth.value = initialWidth
      
      // Add both mouse and touch event listeners
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', stopResize)
      document.addEventListener('touchmove', handleResize, { passive: false })
      document.addEventListener('touchend', stopResize)
      
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }
    
    const handleResize = (e) => {
      if (!isResizing.value) return
      
      // Prevent default touch behavior
      if (e.type === 'touchmove') {
        e.preventDefault()
      }
      
      // Handle both mouse and touch events
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
      const deltaX = clientX - startX.value
      const newWidth = Math.max(250, Math.min(800, startWidth.value + deltaX))
      
      seWidth.value = newWidth
      
      // // Trigger Ace editor resize with a small delay
      // setTimeout(() => {
      //   if (jsonEditorService.aceEditor) {
      //     jsonEditorService.aceEditor.resize()
      //   }
      // }, 0)
    }
    
    const stopResize = () => {
      isResizing.value = false
      
      // Remove both mouse and touch event listeners
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
      document.removeEventListener('touchmove', handleResize)
      document.removeEventListener('touchend', stopResize)
      
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    const setActiveTab = (tab) => {
      activeTab.value = tab
    }

    // If we show the code editor after being hidden or after being on another tab,
    // ask Ace to re-measure.
    const resizeAceSoon = async () => {
      await nextTick()
      setTimeout(() => {
        if (surfaceEditorService.aceEditor) {
          surfaceEditorService.aceEditor.resize()
        }
      }, 0)
    }

    // Trigger an update to size of viewport component to resize it
    const resizeScene = () => {
      //
    }

    // Render the scene, assuming it already exists
    const renderScene = () => {
      // Update variables for the frame
      // if (typeof this.basicScene !== 'undefined' && this.basicScene !== null) {
      //   if (this.basicScene.ctrlKeyPressed) {
      //       this.basicScene.dragControls.transformGroup = false;
      //   }

      //   // Render the frame
      //   this.basicScene.sceneObjects.renderer.render(toRaw(this.basicScene.sceneObjects.scene), toRaw(this.basicScene.sceneObjects.camera));
      // } else {
      //   console.log("SurfaceEditor.js: renderScene(): this.basicScene does not exist!")
      // }
      // // Call next frame
      // basicScene.sceneObjects.renderer.render(basicScene.sceneObjects.scene, basicScene.sceneObjects.camera);
      // console.log(basicScene)
      // renderScene()
    }

    // Resize and render the THREEjs scene for the surface editor
    const showScene = () => {
      // if (typeof basicScene !== 'undefined') {
      //   resizeScene()
      //   renderScene()
      // } else {
      //   console.log("SurfaceEditor.vue: Scene not yet created.")
      // }
    }

    watch(activeTab, (tab) => {
      if (tab === 'code') {
        resizeAceSoon()
      }
    })

    watch(showSurfaceEditor, (isShown) => {
      if (isShown && activeTab.value === 'surface-editor') {
        // Wait for the drawer slide-in transition as well.
        setTimeout(() => showScene(), 320)
      }
    })
    
    return {
      showSurfaceEditor,
      seWidth,
      activeTab,
      startResize,
      // hideSurfaceEditor,
      // expandSurfaceEditor,
      setActiveTab
    }
    // expose({
    //   showSurfaceEditor: showSurfaceEditor,
    //   seWidth: seWidth,
    //   activeTab: activeTab,
    //   startResize: startResize,
    //   // hideSurfaceEditor,
    //   // expandSurfaceEditor,
    //   setActiveTab: setActiveTab
    // })

    // return () =>
  },
  data() {
    return {
      basicScene: null,
      nurbsObjs: null,
      canvas: null,
      renderer: null,
      scene: null,
      grid: null
    }
  },
  created() {
    // this.initScene()
  },
  mounted() {
    // this.initScene()
    // this.renderScene()
    // this.
    if (!this.basicScene || typeof this.basicScene === 'undefined') {
      this.initScene()
    }
    this.renderScene()
  },
  beforeDestroy() {
    // this.renderer.dispose()
    // this.scene.dispose()
  },
  methods: {
    initScene() {

        // // this.canvas = useTemplateRef("surfaceEditorContainer")
      this.canvas = this.$refs.canvas
        
        // // const canvas = ref(null)
        // // const canvas = document.getElementById("surfaceEditorContainer")


        // console.log("canvas", this.canvas)
        // this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas })
        // this.scene = new THREE.Scene()
        // this.basicScene = new BasicScene({ dimension: 2, objects: [], canvas: this.canvas, renderer: this.renderer, scene: this.scene})

        // this.basicScene.sceneObjects.camera.position.z = 1000;

        // this.nurbsObjs = []
        // this.nurbsObjs.push(new SurfaceObject({ threeScene: this.basicScene }))
        // this.basicScene.addObject(this.nurbsObjs[0].nurbsObj)

        // this.grid = new THREE.GridHelper(10000, 250)
        // this.grid.rotation.x = Math.PI * 0.5
        // this.grid.position.z = -1.1
        // this.basicScene.addObject(this.grid)
      // const basicScene = null
      // this.canvas = document.createElement('canvas')
      // this.canvas.setAttribute('ref', 'canvas')
      // this.canvas.setAttribute('id', 'surfaceEditorCanvas')
      console.log(document)
      // document.getElementById('surface-editor').appendChild(this.canvas)
      // const canvas = ref(null)//document.getElementById("surfaceEditorContainer")

      // Initialize the scene for the first time if it doesn't already exist
      // if (typeof this.basicScene === 'undefined' || this.basicScene === null) {
      //   console.log("in setup")
      //   initializeScene()
      // }

      // Set up everything in the scene
      // const initializeScene = () => {
        // this.canvas = useTemplateRef("surfaceEditorContainer")
        // this.canvas = this.$refs.canvas
        // const canvas = ref(null)
        
        // const canvas = ref(null)


      console.log("canvas", this.canvas)
      this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas })
      this.scene = new THREE.Scene()
      this.basicScene = new BasicScene({ dimension: 2, objects: [], canvas: this.canvas, renderer: toRaw(this.renderer), scene: toRaw(this.scene)}) // assuming basicScene already initialized to null

      this.basicScene.sceneObjects.camera.position.z = 1000;

      this.nurbsObjs = []
      this.nurbsObjs.push(new SurfaceObject({ threeScene: this.basicScene, texturePath: '../img/uv_grid_opengl.jpg' }))
      this.basicScene.addObject(this.nurbsObjs[0].nurbsObj)

      this.grid = new THREE.GridHelper(5000, 250)
      this.grid.rotation.x = Math.PI * 0.5
      this.grid.position.z = -1.1
      this.basicScene.addObject(this.grid)

      this.initVueResizeObserver()
      console.log(toRaw(this.basicScene))
      this.basicScene.setupDragControls()
      
    },
    renderScene() {
      // this.basicScene.runRenderLoop(document, this.basicScene.defaultAnimateLoop())
      // // this.basicScene.defaultAnimateLoop()
      // if (this.basicScene.ctrlKeyPressed) {
      //     this.basicScene.dragControls.transformGroup = false;
      // }
      // toRaw(this.basicScene).sceneObjects.renderer.render(toRaw(this.basicScene.sceneObjects.scene), toRaw(this.basicScene.sceneObjects.camera));
      // this.basicScene.sceneObjects.renderer.render(this.basicScene.sceneObjects.scene, this.basicScene.sceneObjects.camera);
      console.log(toRaw(this.basicScene))


      this.basicScene.runRenderLoop(document, () => {
        if (this.basicScene.ctrlKeyPressed) {
            this.basicScene.dragControls.transformGroup = false;
        }
        // this.grid.rotation.x += 0.1  // animation update check
        this.basicScene.sceneObjects.renderer.render(toRaw(this.basicScene.sceneObjects.scene), toRaw(this.basicScene.sceneObjects.camera));
      })
      // toRaw(this.basicScene.sceneObjects.renderer).render(toRaw(this.basicScene.sceneObjects.scene), toRaw(this.basicScene.sceneObjects.camera));
      
      // const unproxy = toRaw(this.basicScene)
      // unproxy.runRenderLoop(document, () => {
      //   if (unproxy.ctrlKeyPressed) {
      //       unproxy.dragControls.transformGroup = false;
      //   }
      //   unproxy.sceneObjects.renderer.render(unproxy.sceneObjects.scene, unproxy.sceneObjects.camera).bind(unproxy);
      // })
      // setTimeout(this.renderScene(), 17)  // ~60 fps
    },
    initVueResizeObserver() {
      this.viewportResizeObserver = new ResizeObserver(entries => { 
        // Resize the viewport for the first element, assuming it is the viewport canvas. 
        for (let entry of entries) {
          //console.log(entry);
          switch (entry.target.id) {
            case "surfaceEditorCanvas":
              // Resize viewport
              // onViewportResize(entry.target);
              console.log(toRaw(this.basicScene.sceneObjects))
              if (this.basicScene.onViewportResize(toRaw(this.basicScene.sceneObjects.renderer))) {
                // If viewport gets resized, update camera params
                const width = this.basicScene.sceneObjects.renderer.domElement.clientWidth
                const height = this.basicScene.sceneObjects.renderer.domElement.clientHeight
                
                // adjust the FOV
                //camera.fov = (360 / Math.PI) * Math.atan(tanFov * (window.innerHeight / initWindowHeight));
                
                // Update aspect ratio and Field of View accordingly
                this.basicScene.sceneObjects.camera.aspect = width / height
                if (this.basicScene.sceneObjects.camera instanceof THREE.PerspectiveCamera) {
                  this.basicScene.sceneObjects.camera.fov = (360 / Math.PI) * Math.atan(this.basicScene.sceneParams.tanFov * (height / this.basicScene.sceneParams.initViewportHeight))
                  this.basicScene.sceneObjects.camera.lookAt(this.basicScene.sceneObjects.scene.position)
                }
                else { //assuming only alternative is orthographic
                  this.basicScene.sceneObjects.camera.right = width
                  this.basicScene.sceneObjects.camera.top = height
                }

                this.basicScene.sceneObjects.camera.updateProjectionMatrix()
              }
              break;
            default:
              // Do nothing
          }
        }
      })
      this.viewportResizeObserver.observe(toRaw(this.canvas))
    }
  }
}
</script>

<style scoped>
/* #surface-editor {
  position: absolute;
  z-index: -2;
  top: 46px;
  left: 0;
  max-width: 100%;
  height: calc(100% - 46px);
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  pointer-events: none;
} */
#surface-editor {
  width: 100%;
  height: 100%;
}

#surface-editor.se-visible {
  transform: translateX(0);
  pointer-events: auto;
}

.se-mobile-height-diff {
  height: 22px;
}

#surfaceEditorCanvas {
  width: 100%;
  height: 100%;
  flex-grow: 1;
  background-color:rgba(45, 51, 57,0.8);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  position: relative;
  display: block;
  flex-direction: column;
}

.se-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.se-tabs-left {
  display: flex;
  gap: 4px;
}

.se-collapse-btn {
  margin-left: auto;
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.se-collapse-btn:hover {
  background: rgba(60, 65, 70, 0.55);
  color: rgba(255, 255, 255, 0.95);
}

.se-collapse-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.se-collapse-btn svg {
  display: block;
  width: 14px;
  height: 14px;
}

.se-tab {
  appearance: none;
  border: none;
  background: rgba(60, 65, 70, 0.35);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.se-tab:hover {
  background: rgba(60, 65, 70, 0.55);
  color: rgba(255, 255, 255, 0.9);
}

.se-tab.active {
  background: rgba(90, 95, 100, 0.9);
  color: rgba(255, 255, 255, 0.95);
}

.se-tab:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.se-tab-content {
  flex-grow: 1;
  min-height: 0;
  position: relative;
}

#surfaceEditor {
  width: 100%;
  height: 100%
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* Drawer toggle button on resize handle */
.drawer-toggle {
  position: absolute;
  top: 50%;
  right: -5px;
  transform: translateY(-50%);
  background-color: rgb(80, 84, 88);
  border: none;
  border-radius: 4px;
  width: 14px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease, width 0.2s ease, right 0.2s ease;
  pointer-events: auto;
  opacity: 0;
}

.resize-handle:hover .drawer-toggle,
.drawer-toggle:hover,
.drawer-toggle:focus-visible {
  opacity: 1;
}

.drawer-toggle:hover,
.drawer-toggle:focus-visible {
  background-color: rgb(90, 95, 100);
  color: rgba(255, 255, 255, 0.9);
  width: 16px;
  right: -6px;
}

/* Hidden state hover region */
.drawer-hover-region {
  position: absolute;
  top: 46px;
  left: 0;
  width: 10px;
  height: calc(100% - 46px);
  z-index: 1000;
  opacity: 0;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 8px;
}

.drawer-hover-region-active {
  opacity: 1;
  pointer-events: auto;
}

.drawer-toggle-expand {
  position: relative;
  left: 0;
  background-color: rgb(55, 60, 65);
  border: none;
  border-radius: 0 4px 4px 0;
  width: 14px;
  height: 40px;
  margin-top: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease, width 0.2s ease;
  opacity: 0;
}

.drawer-toggle-expand svg {
  display: block;
  width: 14px;
  height: 14px;
}

.drawer-hover-region:hover .drawer-toggle-expand,
.drawer-toggle-expand:focus-visible {
  opacity: 1;
  background-color: rgba(60, 65, 70, 0.85);
  color: rgba(255, 255, 255, 0.7);
  width: 18px;
}

.drawer-toggle-expand:hover,
.drawer-toggle-expand:focus-visible {
  background-color: rgba(70, 75, 80, 0.95);
  color: rgba(255, 255, 255, 0.9);
  width: 20px;
}

.drawer-toggle-expand:active {
  background-color: rgba(85, 90, 95, 1);
}
</style>
