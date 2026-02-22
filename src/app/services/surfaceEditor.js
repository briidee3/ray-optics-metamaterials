/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// import * as ace from 'ace-builds';
// import "ace-builds/webpack-resolver";
// import 'ace-builds/src-noconflict/theme-github_dark';
// import 'ace-builds/src-noconflict/mode-json';
// import "ace-builds/src-noconflict/worker-json";
// import { Range } from 'ace-builds';
import { app } from '../services/app'
// import { CustomJsonMode } from '../utils/customJsonMode'
import BasicScene from '../components/nurbs-editor/src/utils/BasicScene'
import SurfaceObject from '../components/nurbs-editor/src/utils/NURBSSurface'
import * as THREE from 'three'
import { jsonEditorService } from './jsonEditor'

const meshResolutionModifier = 1    // Multiplier for mesh resolution, e.g. number of faces in a circle mesh

/**
 * Service to manage the NURBS surface editor instance and its interactions with the scene
 */
class SurfaceEditorService {
  constructor() {

    // Initialize scene
    /* 
     * TODO:
     * - don't have this stuff loaded when side window minimized
     * - set this up or delete it (this file)
     */
    this.sceneSetup = null
    this.canvas = null
    this.renderer = null
    this.scene = null

    this.nurbsObjs = []

    this.defaultParams = {
      degree1: 3,
      degree2: 3,
      knots1: [ 0, 0, 0, 0, 1, 1, 1, 1 ],
      knots2: [ 0, 0, 0, 0, 1, 1, 1, 1 ],
      weights: [
        [ 1, 1, 1, 1 ],
        [ 1, 1, 1, 1 ],
        [ 1, 1, 1, 1 ],
        [ 1, 1, 1, 1 ]
      ],
      ctrlPts: [
        [
          new THREE.Vector4( - 200, - 200, 0, 1 ),
          new THREE.Vector4( - 200, - 100, 0, 1 ),
          new THREE.Vector4( - 200, 0, 0, 1 ),
          new THREE.Vector4( - 200, 100, 0, 1 )
        ],
        [
          new THREE.Vector4( -100, - 200, 0, 1 ),
          new THREE.Vector4( -100, - 100, 0, 1 ),
          new THREE.Vector4( -100, 0, 0, 1 ),
          new THREE.Vector4( -100, 100, 0, 1 )
        ],
        [
          new THREE.Vector4( 0, - 200, 0, 1 ),
          new THREE.Vector4( 0, - 100, 0, 1 ),
          new THREE.Vector4( 0, 0, 0, 1 ),
          new THREE.Vector4( 0, 100, 0, 1 )
        ],
        [
          new THREE.Vector4( 100, - 200, 0, 1 ),
          new THREE.Vector4( 100, - 100, 0, 1 ),
          new THREE.Vector4( 100, 0, 0, 1 ),
          new THREE.Vector4( 100, 100, 0, 1 )
        ]
      ]
    }

    // Default material for lenses
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xAAAAAA, side: THREE.DoubleSide })
    this.lineMat = new THREE.LineBasicMaterial( { color: 0xAAAAAA, side: THREE.DoubleSide } );

    this.curLens = -1
    this.pdrosObjInScene = false

    this.canvas = document.createElement("canvas")
    this.canvas.setAttribute("id", "surfaceEditorCanvas")
    this.canvas.setAttribute("style", `
      width: 100%;
      height: 100%;
      flex-grow: 1;
      background-color:rgba(45, 51, 57,0.8);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      position: relative;
      display: block;
      flex-direction: column;
    `)

    this.sceneSetup = this.createSESession()
  }

  /**
   * Handle changes in the editor content
   */
  handleEditorChange() {
    if (this.lastCodeChangeIsFromScene) {
      setTimeout(() => {
        this.lastCodeChangeIsFromScene = false
      }, 100)
      return
    }

    this.isSynced = false
    if (!this.manualParse) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.parse()
      }, 500)
    } else {
      if (app.canvas) {
        // Dim the canvases to indicate that the scene is out of sync
        app.canvas.style.opacity = 0.5;
        app.canvasBelowLight.style.opacity = 0.5;
        app.canvasLight.style.opacity = 0.5;
        app.canvasLightWebGL.style.opacity = 0.5;
        app.canvasGrid.style.opacity = 0.5;
      }
      app.setHasUnsavedChange(true)
    }
  }

  /**
   * Parse the JSON content to the scene
   */
  parse() {
    try {
      app.editor?.loadJSON(this.aceEditor.session.getValue())
      window.error = null
      app.editor?.onActionComplete(true)
      if (!app.scene.error) {
        this.isSynced = true
        if (app.canvas) {
          app.canvas.style.opacity = 1.0;
          app.canvasBelowLight.style.opacity = 1.0;
          // Note that we do not reset the opacity of the light layer canvases, as they are done by the simulator (it will still be dimmed until the simulation is refreshed)
          app.canvasGrid.style.opacity = 1.0;
        }
      } else {
        app.setHasUnsavedChange(true)
      }


    } catch (e) {
      console.error('Error updating scene from JSON:', e)
    }
  }

  /**
   * Clean up the editor instance
   */
  cleanup() {
    if (!this.aceEditor) return

    if (!this.isSynced) {
      // Parse the scene to avoid losing any unsaved changes in the JSON editor.
      this.parse()
    }

    this.aceEditor.destroy()
    this.aceEditor = null
  }

  // /**
  //  * Update the editor's content, optionally highlighting changes
  //  * @param {string} content - New content for the editor
  //  * @param {string} [oldContent] - Previous content for diff calculation
  //  * @param {boolean} [force] - Force update the content even if the editor is out of sync
  //  */
  // updateContent(content, oldContent, force = false) {
  //   if (!this.aceEditor) return
  //   if (force) {
  //     if (!this.isSynced) {
  //       this.isSynced = true
  //       if (app.canvas) {
  //         app.canvas.style.opacity = 1.0;
  //         app.canvasBelowLight.style.opacity = 1.0;
  //         // Note that we do not reset the opacity of the light layer canvases, as they are done by the simulator (it will still be dimmed until the simulation is refreshed)
  //         app.canvasGrid.style.opacity = 1.0;
  //       }
  //     }
  //   } else if (!this.isSynced) {
  //     return; // Normally, we should not update the content if the editor is out of sync, as the user may be editing the JSON and updating the content will overwrite the changes.
  //   }
    
  //   // Blur the editor to remove focus when content is updated
  //   this.aceEditor.blur()

  //   if (oldContent && content !== oldContent) {
  //     // Calculate the position of the first and last character that has changed
  //     var minLen = Math.min(content.length, oldContent.length);
  //     var startChar = 0;
  //     while (startChar < minLen && content[startChar] == oldContent[startChar]) {
  //       startChar++;
  //     }
  //     var endChar = 0;
  //     while (endChar < minLen && content[content.length - 1 - endChar] == oldContent[oldContent.length - 1 - endChar]) {
  //       endChar++;
  //     }

  //     // Convert character positions to row/column positions
  //     var startPos = this.aceEditor.session.doc.indexToPosition(startChar);
  //     var endPos = this.aceEditor.session.doc.indexToPosition(content.length - endChar);

  //     // Update content and highlight changes
  //     this.lastCodeChangeIsFromScene = true
  //     this.aceEditor.session.setValue(content)
  //     this.aceEditor.selection.setRange(new Range(startPos.row, startPos.column, endPos.row, endPos.column))

  //     // Scroll to the first line that has changed
  //     this.aceEditor.scrollToLine(startPos.row, true, true, function () { });
  //   } else {
  //     // Just update content without highlighting
  //     this.lastCodeChangeIsFromScene = true
  //     this.aceEditor.session.setValue(content)
  //   }
  // }

  // Based loosely on ace.js' edit function
  setContainer(id_) {
    // if (typeof el === "string") {
    // const id_ = el
    const el = document.getElementById(id_)
    if (!el) {
      throw new Error("SurfaceEditorService.setContainer can't find element with id #" + id_)
    }
    // }

    // if (el && el.env && el.env.surfaceEditor instanceof SurfaceEditor)
    el.appendChild(this.canvas)
  }

  createSESession(nurbsObjs) {

    console.log("canvas", this.canvas)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas })
    this.scene = new THREE.Scene()
    this.basicScene = new BasicScene({ dimension: 2, objects: [], canvas: this.canvas, renderer: this.renderer, scene: this.scene}) // assuming basicScene already initialized to null

    this.basicScene.sceneObjects.camera.position.z = 1000;

    if (nurbsObjs) {
      this.nurbsObjs = nurbsObjs
    } else {
      this.nurbsObjs = []
      this.nurbsObjs.push(new SurfaceObject({ threeScene: this.basicScene, texturePath: '../img/uv_grid_opengl.jpg', geomResolution: 50 * meshResolutionModifier }))
    }
    this.basicScene.addObject(this.nurbsObjs[0].nurbsObj)

    // this.grid = new THREE.GridHelper(5000, 250)
    // this.grid.rotation.x = Math.PI * 0.5
    // this.grid.position.z = -1.1
    // this.basicScene.sceneObjects.scene.add(this.grid)

    this.initVueResizeObserver()
    this.basicScene.setupDragControls()

    // Handle updates to JSON of object of focus when NURBS surface is edited
    this.canvas.addEventListener("nurbs-surface-updated", (e) => {
      this.updateJson(e.detail.surfaceObj.nurbsParams)
    })
  }

  renderScene() {
    // console.log(this.basicScene)
    if (this.basicScene) {
      this.basicScene.runRenderLoop(document, () => {
        if (this.basicScene.ctrlKeyPressed) {
            this.basicScene.dragControls.transformGroup = false;
        }
        // this.grid.rotation.x += 0.1  // animation update check
        this.basicScene.sceneObjects.renderer.render(this.basicScene.sceneObjects.scene, this.basicScene.sceneObjects.camera);
      })
    } else {
      throw new Error("SurfaceEditorService.renderScene: this.basicScene does not exist")
    }
  }

  initVueResizeObserver() {
    this.viewportResizeObserver = new ResizeObserver(entries => { 
      // Resize the viewport for the first element, assuming it is the viewport canvas. 
      for (let entry of entries) {
        //console.log(entry);
        switch (entry.target.id) {
          case "surfaceEditorCanvas":
            // Resize viewport
            // onViewportResize(entry.target);
            console.log(this.basicScene.sceneObjects)
            if (this.basicScene.onViewportResize(this.basicScene.sceneObjects.renderer)) {
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
    this.viewportResizeObserver.observe(this.canvas)
  }

  // Set which lens to be working on currently
  setLensContext(index) {
    if (!this.pdrosObjInScene) {
      this.index = index
    } else {
      // Remove previous lens if one exists in the 3js scene
      this.basicScene.sceneObjects.scene.remove(this.basicScene.sceneObjects.scene.getObjectByName("pdros-lens-" + String(this.index)))

      this.index = index
    }
    
    this.curJsonState = JSON.parse(jsonEditorService.aceEditor.getValue())
    this.curLensJson = this.curJsonState.objs[this.index]

    if (this.curLensJson.toEnabled) {   // check if GUI transformation optics enabled
      this.seUpdateLens(this.curLensJson)
    } else {
      console.warn("SurfaceEditorService: Warning! Current lens does not have transformation optics functionality enabled!\nTo enable, go to the \"Surface Editor\" tab in the sidebar.")
    }
  }

  // Import lens into scene as an immovable object which cannot be interacted with
  seImportLens(pdrosJsonObject) {
    if (pdrosJsonObject.type.includes("Glass") && pdrosJsonObject.type.includes("Grin")) {  // Only accept scene objects which already support gradient index fields
      this.curLensThreeObj = []
      switch (pdrosJsonObject.type) {
        case "CircleGrinGlass": {
          const center = pdrosJsonObject.p1
          const r = Math.sqrt(Math.pow((pdrosJsonObject.p2.x - pdrosJsonObject.p1.x), 2) + Math.pow((pdrosJsonObject.p2.y - pdrosJsonObject.p1.y), 2))
          const geom = new THREE.RingGeometry(r - 10, r, 48 * meshResolutionModifier)
          this.curLensThreeObj[0] = new THREE.Mesh(geom, this.lensMat)
          this.curLensThreeObj[0].position.set(center.x, -center.y, -1)   // -1 to put it behind the NURBS surface
          this.curLensThreeObj[0].name = "pdros-lens-" + String(this.index)

          // Add to scene, but not to DragControls; let the lens and its position only be manipulated from within the primary editor of PDROS
          this.basicScene.sceneObjects.scene.add(this.curLensThreeObj[0])
          // this.basicScene.objects.add(obj)

          break;
        }
        case "CurveGrinGlass": {
          // const geom  = 
          const curves = []
          const curvesGeoms = []
          const curvesMats = []
          const curvesMeshes = []
          for (let i = 0; i < pdrosJsonObject.points.length; i++) {
            // Y-axis is flipped relative to the PDROS coords system
            curves.push(new THREE.CubicBezierCurve(
              new THREE.Vector2(pdrosJsonObject.points[i].a1.x, -pdrosJsonObject.points[i].a1.y), 
              new THREE.Vector2(pdrosJsonObject.points[i].c1.x, -pdrosJsonObject.points[i].c1.y), 
              new THREE.Vector2(pdrosJsonObject.points[i].c2.x, -pdrosJsonObject.points[i].c2.y), 
              new THREE.Vector2(pdrosJsonObject.points[(i + 1) % pdrosJsonObject.points.length].a1.x, -pdrosJsonObject.points[(i + 1) % pdrosJsonObject.points.length].a1.y), 
            ))
            const curIndex = curves.length - 1
            curvesGeoms.push(new THREE.BufferGeometry().setFromPoints( curves[curIndex].getPoints(50 * meshResolutionModifier) ))
            // Create the final object to add to the scene
            curvesMeshes.push(new THREE.Line( curvesGeoms[curIndex], this.lineMat ))
            curvesMeshes[curIndex].name = "pdros-lens-" + String(this.index) + "-" + String(i)

            this.curLensThreeObj.push(curvesMeshes[curIndex])
            this.basicScene.sceneObjects.scene.add(this.curLensThreeObj[curIndex])
          }
        
          break;
        }
        case "GrinGlass":
          break;
        case "ParamGrinGlass":
          break;
        default:
          throw new Error("SurfaceEditorService.importLens: Could not import lens; lens does not supported or doesn't support GRIN")
      }
    }
  }

  seUpdateLens(pdrosJsonObject) {
    var cur = this.basicScene.sceneObjects.scene.getObjectByName("pdros-lens-" + String(this.index))
    while (typeof cur !== 'undefined') {  // Lens may be multiple parts, e.g. multiple curves bounding a lens, so account for that here
      if (cur) {
        // Remove it if it's there
        this.basicScene.sceneObjects.scene.remove(this.basicScene.sceneObjects.scene.getObjectByName("pdros-lens-" + String(this.index)))
      }

      cur = this.basicScene.sceneObjects.scene.getObjectByName("pdros-lens-" + String(this.index))
    }
    this.seImportLens(pdrosJsonObject)
  }

  setNurbsParams(params, index) {
    if (!index) { index = 0 }

    if (this.nurbsObjs.length > index){
      this.nurbsObjs[index].updateNurbs(params)
    } else if (this.nurbsObjs.length < index) {
      this.nurbsObjs.push(new SurfaceObject({ nurbsParams: params, threeScene: this.basicScene, texturePath: '../img/uv_grid_opengl.jpg', geomResolution: 50 * meshResolutionModifier }))
      return this.nurbsObjs.length - 1
    } else {
      this.nurbsObjs[0].updateNurbs(params)
    }
    return index
  }

  // Update the NURBS obj for the current lens in the JSON representation of the PDROS scene
  updateJson(params) {
    console.log(this.curLensJson)
    if (this.curLensJson) {
      // Add NURBS surface params to object's JSON
      if (this.curLensJson.toEnabled) {
        this.curJsonState.objs[this.index].toNurbsSurfaceParams = params
      }

      jsonEditorService.updateContent(JSON.stringify(this.curJsonState, null, 2))
      jsonEditorService.parse()
      app.syncUrl()
    } else {
      console.warn("surfaceEditor.updateJson: No lens selected for surface editor")
    }
  }

  getNURBSObjs() {
    return this.nurbsObjs
  }

  setNURBSObjs(nurbsParams) {
    // this.nurbsObjs = 
  }

  setSceneObj(obj, index) {
    
  }

  moveCamToLens() {
    if (this.curLensThreeObj) {
      this.basicScene.sceneObjects.camera.position.set(this.curLensThreeObj[0].x, this.curLensThreeObj[0].y)
    } else {

    }
  }
}

// Export a singleton instance
export const surfaceEditorService = new SurfaceEditorService()
