/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
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

import BaseGlass from './BaseGlass.js';
import geometry from '../geometry.js';
import Simulator from '../Simulator.js';
import i18next from 'i18next';
import { evaluateLatex } from '../equation.js';
import { parseTex } from 'tex-math-parser'
import * as math from 'mathjs';
import { pointInversionXYZ, calcNURBSSurfaceDerivativesXYZ } from '../../app/components/nurbs-editor/src/utils/NURBSSurface.js';
import { Vector3 } from 'three';
import { surfaceEditorService } from '../../app/services/surfaceEditor.js';

/**
 * @typedef {Object} BodyMergingObj
 * Every ray has a temporary bodyMerging object ("bodyMergingObj") as a property (this property exists only while the ray is inside a region of one or several overlapping grin objects - e.g. CircleGrinGlass and GrinGlass), which gets updated as the ray enters/exits into/from grin objects, using the "multRefIndex"/"devRefIndex" function, respectively.
 * @property {function} fn_p - The refractive index function for the equivalent region of the simulation.
 * @property {function} fn_p_der_x - The x derivative of `fn_p` for the equivalent region of the simulation.
 * @property {function} fn_p_der_y - The y derivative of `fn_p` for the equivalent region of the simulation.
 */

/**
 * The base class for glasses.
 * @class
 * @extends BaseGlass
 * @property {string} p - The refractive index function (a function of x and y, related to `origin`) of the glass in math.js string.
 * @property {string} refIndexFn - The refractive index function of the glass in LaTeX.
 * @property {string} p_der_x - The x derivative of `p` in math.js string.
 * @property {string} p_der_x_tex - The x derivative of `p` in LaTeX.
 * @property {string} p_der_y - The y derivative of `p` in math.js string.
 * @property {string} p_der_y_tex - The y derivative of `p` in LaTeX.
 * @property {Point} origin - The origin of (x,y) used in the above equationns.
 * @property {function} fn_p - The evaluatex function for `p`, where (x,y) has been shifted to the absolute coordinates.
 * @property {function} fn_p_der_x - The evaluatex function for `p_der_x`, where (x,y) has been shifted to the absolute coordinates.
 * @property {function} fn_p_der_y - The evaluatex function for `p_der_y`, where (x,y) has been shifted to the absolute coordinates.
 * @property {number} stepSize - The step size for the ray trajectory equation.
 * @property {number} intersectTol - The epsilon for the intersection calculations.
 * @property {boolean} toEnabled - Toggle for transformation optics functionality with the surface editor
 * @property {object} toNurbsSurfaceParams - NURBS Surface parameters for defining coordinates for use with transformation optics
 * @property {object} toNurbsSurfaceObj - SurfaceObject instance used for calculations with regards to the NURBS surface
 * @property {number} uvStepSize - The step size in uv-space (for use w/ TO), where the coordinates can range from 0 to 1 for either axis
 * @property {number} inversionTol - Error tolerance for point inversion
 * @property {number} maxIterations - Max iterations for point inversion
 */
class BaseGrinGlass extends BaseGlass {

  constructor(scene, jsonObj) {
    super(scene, jsonObj);
    this.initFns();

    // Transformation Optics initialization
    try {
      console.log(this.serialize());
      this.toNurbsSurfaceObj = surfaceEditorService.seImportLens(this.serialize());
      // if (this.toNurbsSurfaceParams) {
      //   // this.updateNURBSObj(this.toNurbsSurfaceParams.nurbsParams);
      //   this.updateNURBSObj();
      // }
      // this.toNurbsSurfaceParams = this.toNurbsSurfaceObj.nurbsParams;
      console.log(this.toNurbsSurfaceObj)
    } catch (e) {
      console.error(e.toString());
    }
  }

  populateObjBar(objBar) {
    if (!this.fn_p) {
      this.initFns();
    }
    objBar.createEquation('n(x,y) = ', this.refIndexFn, function (obj, value) {
      obj.refIndexFn = value;
      obj.initFns();
    }, '<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log arcsin arccos arctan</code></li><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.lambda', {lambda: '<code>lambda</code>'}) + '</li><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.diff') + '</li><li>' + (this.constructor.type === 'ParamGrinGlass' ? '' : i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.origin') + '</li><li>') + i18next.t('simulator:sceneObjs.BaseGrinGlass.refIndexFnInfo.accuracy') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');

    objBar.createEquation('α(x,y) = ', this.absorptionFn, function (obj, value) {
      obj.absorptionFn = value;
      obj.initFns();
    }, '<ul><li>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.absorptionFnInfo.absorption') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');

    if (this.constructor.type !== 'ParamGrinGlass') {
      objBar.createTuple(i18next.t('simulator:sceneObjs.common.coordOrigin'), '(' + this.origin.x + ',' + this.origin.y + ')', function (obj, value) {
        const commaPosition = value.indexOf(',');
        if (commaPosition != -1) {
          const n_origin_x = parseFloat(value.slice(1, commaPosition));
          const n_origin_y = parseFloat(value.slice(commaPosition + 1, -1));
          obj.origin = geometry.point(n_origin_x, n_origin_y);
          obj.initFns();
        }
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['stepSize']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGrinGlass.stepSize'), 0.1 * this.scene.lengthScale, 1 * this.scene.lengthScale, 0.1 * this.scene.lengthScale, this.stepSize, function (obj, value) {
        obj.stepSize = parseFloat(value);
      }, '<p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.stepSizeInfo') + '</p>', true);
    }
    if (objBar.showAdvanced(!this.arePropertiesDefault(['intersectTol']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGrinGlass.intersectTol'), 1e-3, 1e-2, 1e-3, this.intersectTol, function (obj, value) {
        obj.intersectTol = parseFloat(value);
      }, '<p>' + i18next.t(`simulator:sceneObjs.${this.constructor.type}.epsInfo.units`) + '</p><p>' + i18next.t(`simulator:sceneObjs.${this.constructor.type}.epsInfo.functions`) + '</p>', true);
    }

    if (objBar.showAdvanced(this.scene.symbolicBodyMerging)) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMerging'), this.scene.symbolicBodyMerging, function (obj, value) {
        obj.scene.symbolicBodyMerging = value;
      }, '<p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMergingInfo.all') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMergingInfo.impl') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGrinGlass.symbolicBodyMergingInfo.implNote') + '</p>');
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['partialReflect']))) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseGlass.partialReflect'), this.partialReflect, function (obj, value) {
        obj.partialReflect = value;
      });
    }

  }

  getZIndex() {
    return 0;
  }

  fillGlass(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (isAboveLight) {
      // Draw the highlight only
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = isHovered ? this.scene.highlightColorCss : ('transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.grinGlass.color);
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }

  getRefIndexAt(point, ray) {
    return this.fn_p({ x: point.x, y: point.y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
  }

  onRayEnter(ray) {
    if (!ray.bodyMergingObj) {
      ray.bodyMergingObj = this.initRefIndex(ray);
    }
    ray.bodyMergingObj = this.multRefIndex(ray.bodyMergingObj);
    
    console.log(ray)
    // Make new point in lens in uv-space
    // console.log(this.toNurbsSurfaceObj)
    // const tmp = pointInversionXYZ(this.inversionTol / 10, this.inversionTol, this.maxIterations, new Vector3(ray.p2.x, -ray.p2.y, 0), 0.707, this.toNurbsSurfaceObj)
    // ray.p2 = geometry.point(tmp.x, tmp.y);
    // ray.p2.isUv = true;
  }

  onRayExit(ray) {
    if (!ray.bodyMergingObj) {
      ray.bodyMergingObj = this.initRefIndex(ray);
    }
    ray.bodyMergingObj = this.devRefIndex(ray.bodyMergingObj);
    
    // Make next point outside uv-space
    console.log(ray)
    // const tmp = new Vector3(0, 0, 0);
    // this.toNurbsSurfaceObj.getPoint(ray.p2.x, ray.p2.y, tmp);
    // ray.p2 = geometry.point(tmp.x + this.toNurbsSurfaceParams.nurbsPos, -tmp.y - this.toNurbsSurfaceParams.nurbsPos);
    // ray.p2.isUv = false;
  }


  /* Utility Methods */

  /**
   * Do the partial derivatives of the refractive index function and parse the functions.
   */
  initFns() {
    this.error = null;
    try {
      this.p = parseTex(this.refIndexFn.replaceAll("\\lambda", "z")).toString().replaceAll("\\cdot", "*").replaceAll("\\frac", "/");
      this.p_der_x = math.derivative(this.p, 'x').toString();
      this.p_der_x_tex = math.parse(this.p_der_x).toTex().replaceAll("{+", "{"); // 'evaluateLatex' function can't and can handle expressions of the form '...num^{+exp}...' and '...num^{exp}...', respectively, where num and exp are numbers
      this.p_der_y = math.derivative(this.p, 'y').toString();
      this.p_der_y_tex = math.parse(this.p_der_y).toTex().replaceAll("{+", "{");
      this.fn_p = evaluateLatex(this.shiftOrigin(this.refIndexFn.replaceAll("\\lambda", "z")));
      this.fn_p_der_x = evaluateLatex(this.shiftOrigin(this.p_der_x_tex));
      this.fn_p_der_y = evaluateLatex(this.shiftOrigin(this.p_der_y_tex));

      this.fn_alpha = evaluateLatex(this.shiftOrigin(this.absorptionFn.replaceAll("\\lambda", "z")));
    } catch (e) {
      delete this.fn_p;
      delete this.fn_p_der_x;
      delete this.fn_p_der_y;
      delete this.fn_alpha;
      this.error = e.toString();
    }
  }

  /**
   * Shifts the x and y variables in `equation` from related to `this.origin` to  the absolute coordinates.
   * @param {string} equation
   * @returns {string} 
   */
  shiftOrigin(equation) {
    return equation.replaceAll("x", "(x-" + this.origin.x + ")").replaceAll("y", "(y-" + this.origin.y + ")");
  }
  
  /**
   * Receives a bodyMerging object and returns a new bodyMerging object for the overlapping region of `bodyMergingObj` and the current GRIN glass.
   * @param {BodyMergingObj} bodyMergingObj 
   * @returns {BodyMergingObj}
   */
  multRefIndex(bodyMergingObj) {
    if (this.scene.symbolicBodyMerging) {
      let mul_p = math.simplify('(' + bodyMergingObj.p + ')*' + '(' + this.shiftOrigin(this.p) + ')').toString();

      let mul_fn_p = evaluateLatex(math.parse(mul_p).toTex());

      let mul_fn_p_der_x = evaluateLatex(math.derivative(mul_p, 'x').toTex());

      let mul_fn_p_der_y = evaluateLatex(math.derivative(mul_p, 'y').toTex());

      let sum_alpha = '\\left(' + bodyMergingObj.alpha + '\\right) + \\left(' + this.shiftOrigin(this.absorptionFn.replaceAll("\\lambda", "z")) + '\\right)';

      let sum_fn_alpha = evaluateLatex(sum_alpha);

      return { p: mul_p, fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y, alpha: sum_alpha, fn_alpha: sum_fn_alpha };
    } else {
      let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [this.fn_p, this.fn_p_der_x, this.fn_p_der_y, bodyMergingObj.fn_p, bodyMergingObj.fn_p_der_x, bodyMergingObj.fn_p_der_y];

      let mul_fn_p = (function (fn_p, new_fn_p) {
        return function (param) {
          return fn_p(param) * new_fn_p(param);
        };
      })(fn_p, new_fn_p);

      let mul_fn_p_der_x = (function (fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x) {
        return function (param) {
          return fn_p(param) * new_fn_p_der_x(param) + fn_p_der_x(param) * new_fn_p(param); // product chain rule
        };
      })(fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x);

      let mul_fn_p_der_y = (function (fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y) {
        return function (param) {
          return fn_p(param) * new_fn_p_der_y(param) + fn_p_der_y(param) * new_fn_p(param); // product chain rule
        };
      })(fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y);

      let sum_fn_alpha = (function (fn_alpha, new_fn_alpha) {
        return function (param) {
          return fn_alpha(param) + new_fn_alpha(param);
        };
      })(this.fn_alpha, bodyMergingObj.fn_alpha);

      return { fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y, fn_alpha: sum_fn_alpha };
    }
  }

  /**
   * Receives a bodyMerging object and returns a new bodyMerging object for the region of `bodyMergingObj` excluding current GRIN glass.
   * @param {BodyMergingObj} bodyMergingObj 
   * @returns {BodyMergingObj}
   */
  devRefIndex(bodyMergingObj) {
    if (this.scene.symbolicBodyMerging) {
      let dev_p = math.simplify('(' + bodyMergingObj.p + ')/' + '(' + this.shiftOrigin(this.p) + ')').toString();

      let dev_fn_p = evaluateLatex(math.parse(dev_p).toTex());

      let dev_fn_p_der_x = evaluateLatex(math.derivative(dev_p, 'x').toTex());

      let dev_fn_p_der_y = evaluateLatex(math.derivative(dev_p, 'y').toTex());

      let diff_alpha = '\\left(' + bodyMergingObj.alpha + '\\right) - \\left(' + this.shiftOrigin(this.absorptionFn.replaceAll("\\lambda", "z")) + '\\right)';

      let diff_fn_alpha = evaluateLatex(diff_alpha);

      return { p: dev_p, fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y, alpha: diff_alpha, fn_alpha: diff_fn_alpha };
    } else {
      let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [this.fn_p, this.fn_p_der_x, this.fn_p_der_y, bodyMergingObj.fn_p, bodyMergingObj.fn_p_der_x, bodyMergingObj.fn_p_der_y];

      let dev_fn_p = (function (fn_p, new_fn_p) {
        return function (param) {
          return new_fn_p(param) / fn_p(param);
        };
      })(fn_p, new_fn_p);

      let dev_fn_p_der_x = (function (fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x) {
        return function (param) {
          return new_fn_p_der_x(param) / fn_p(param) - new_fn_p(param) * fn_p_der_x(param) / (fn_p(param) ** 2); // product chain rule
        };
      })(fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x);

      let dev_fn_p_der_y = (function (fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y) {
        return function (param) {
          return new_fn_p_der_y(param) / fn_p(param) - new_fn_p(param) * fn_p_der_y(param) / (fn_p(param) ** 2); // product chain rule
        };
      })(fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y);

      let diff_fn_alpha = (function (fn_alpha, new_fn_alpha) {
        return function (param) {
          return new_fn_alpha(param) - fn_alpha(param);
        };
      })(this.fn_alpha, bodyMergingObj.fn_alpha);

      return { fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y, fn_alpha: diff_fn_alpha };
    }
  }

  /**
   * Receives a ray, and returns a bodyMerging object for the point ray.p1
   * @param {Ray} ray 
   * @returns {BodyMergingObj}
   */
  initRefIndex(ray) {
    let obj_tmp;
    for (let obj of this.scene.opticalObjs) {
      if ((obj instanceof BaseGrinGlass) && (obj.isOnBoundary(ray.p1) || obj.isInsideGlass(ray.p1))) {
        if (!obj_tmp) {
          obj_tmp = {};
          obj_tmp.p = obj.shiftOrigin(obj.p);
          obj_tmp.fn_p = obj.fn_p;
          obj_tmp.fn_p_der_x = obj.fn_p_der_x;
          obj_tmp.fn_p_der_y = obj.fn_p_der_y;
          obj_tmp.alpha = obj.shiftOrigin(obj.absorptionFn.replaceAll("\\lambda", "z"));
          obj_tmp.fn_alpha = obj.fn_alpha;
        } else {
          obj_tmp = obj.multRefIndex(obj_tmp);
        }
      }
    }
    if (!obj_tmp) {
      obj_tmp = { p: 1, fn_p: function () { return 1; }, fn_p_der_x: function () { return 0; }, fn_p_der_y: function () { return 0; }, alpha: '0', fn_alpha: function () { return 0; } };
    }
    return obj_tmp;
  }

  /**
   * Do the refraction calculation at the surface of the glass. 
   * @param {Ray} ray - The ray to be refracted.
   * @param {number} rayIndex - The index of the ray in the ray array.
   * @param {Point} incidentPoint - The incident point.
   * @param {Point} normal - The normal vector at the incident point.
   * @param {number} n1 - The effective refractive index of the current object (after determining the direction of incident of the current object, but before merging the surface with other objects).
   * @param {Array<BaseGlass>} surfaceMergingObjs - The objects that are to be merged with the current object.
   * @param {BaseGrinGlass} bodyMergingObj - The object that is to be merged with the current object.
   * @returns {SimulationReturn} The return value for `onRayIncident`.
   */
  refract(ray_, rayIndex, incidentPoint_, normal, n1, surfaceMergingObjs, bodyMergingObj) {
    var ray = {...ray_};
    var incidentPoint = {...incidentPoint_};

    // If using TO, use the parametric ray-tracing method
    if (this.toEnabled) {
      // Convert uv-coords to xy-coords by plugging in to the NURBS surface function
      // Flipping y back and forth to account for flipped y betwee xy and uv coords systems
      // const tmp = new Vector3(0, 0, 0);
      // Temporarily doing if vector length of thepoint is < 1, since for points in UV-space, that should always be true. this should be changed as soon as possible, since otherwise it could cause unintentional consequences.
      // if (ray_.p1.isUv || geometry.length(ray_.p1) < 2) {
      //   this.toNurbsSurfaceObj.getPoint(ray.p1.x, -ray.p1.y, tmp);
      //   ray.p1 = geometry.point(tmp.x + this.toNurbsSurfaceParams.nurbsPos.x, -tmp.y - this.toNurbsSurfaceParams.nurbsPos.y);  // Add nurbs position offset as well
      // }
      // if (ray_.p2.isUv || geometry.length(ray_.p2) < 2) {
      //   this.toNurbsSurfaceObj.getPoint(ray.p2.x, -ray.p2.y, tmp);
      //   ray.p2 = geometry.point(tmp.x + this.toNurbsSurfaceParams.nurbsPos.x, -tmp.y - this.toNurbsSurfaceParams.nurbsPos.y);
      // }
      // if (incidentPoint_.isUv || geometry.length(incidentPoint_) < 2) {
      //   this.toNurbsSurfaceObj.getPoint(incidentPoint.x, -incidentPoint.y, tmp);
      //   incidentPoint = geometry.point(tmp.x + this.toNurbsSurfaceParams.nurbsPos.x, -tmp.y - this.toNurbsSurfaceParams.nurbsPos.y);
      // } else {
      //   // Make it uv if not already (should always be in uv-space if TO enabled)
      //   incidentPoint = {...incidentPoint_};
      //   incidentPoint_ = pointInversionXYZ(this.inversionTol / 10, this.inversionTol, this.maxIterations, new Vector3(incidentPoint_.x, -incidentPoint_.y, 0), 0.707, this.toNurbsSurfaceObj);
      // }

      if (ray_.p1.isUv || geometry.length(ray_.p1) < 2) {
        // p2 and p1 in UV
        if (ray_.p2.isUv || geometry.length(ray_.p2) < 2) {
          const tmp = { isUv: true, x: ray_.p2.x + (ray_.p2.x - ray_.p1.x), y: ray_.p2.y + (ray_.p2.y - ray_.p1.y) };
          ray_.p1 = ray_.p2;
          ray_.p2 = tmp;

          return {
            newRays: [],
            truncation: 0
          };
        } 
        // Inside to out (p1 in UV, p2 in XY). //this should be handled elsewhere, never here (temporarily skipped for time) // might be wrong on this one
        else {
          
          // return {
          //   isAbsorbed: true,
          //   isUndefinedBehavior: true
          // };

          // make first point in XY then refract as normal
          const p1_xy = new Vector3();
          this.toNurbsSurfaceObj.getPoint(ray_.p1.x, ray_.p1.y, p1_xy);
          ray_.p1 = geometry.point(p1_xy.x, -p1_xy.y);  // Flip y axis when going between THREEjs coords and PDROS coords. 
        }
      }
      // Outside to inside (XY to UV)
      else if (ray_.p2.isUv || geometry.length(ray_.p2) < 2) {
        // Assuming the one outside is still within the span of the NURBS surface (in XY-space) representing UV-space
        const p1_uv = pointInversionXYZ(this.inversionTol / 10, this.inversionTol, this.maxIterations, new Vector3(ray_.p1.x, -ray_.p1.y, 0), 0.707, this.toNurbsSurfaceObj);
        console.log(p1_uv)

        // Update the ray
        const tmp = { isUv: true, x: ray_.p2.x + (ray_.p2.x - p1_uv[0]), y: ray_.p2.y + (ray_.p2.y - p1_uv[1]) };
        ray_.p1 = ray_.p2;
        ray_.p2 = tmp;

        return {
          newRays: [],
          truncation: 0
        };
      }
      // else {
      //   // Disable normal refraction (for now) by just doing nothing, essentially
      //   return {
      //     newRays: [],
      //     truncation: 0
      //   }
      // }
    }

    // If it reaches here, TO has not been used for this current iteration of refraction; in which case, set ray = ray_ to set the pointer for the ray and continue as normal (pun intended)
    ray = ray_;
    
    // Surface merging
    for (var i = 0; i < surfaceMergingObjs.length; i++) {
      let incidentType = surfaceMergingObjs[i].getIncidentType(ray);
      if (incidentType == 1) {
        // From inside to outside
        n1 *= surfaceMergingObjs[i].getRefIndexAt(incidentPoint, ray);
        surfaceMergingObjs[i].onRayExit(ray);
      } else if (incidentType == -1) {
        // From outside to inside
        n1 /= surfaceMergingObjs[i].getRefIndexAt(incidentPoint, ray);
        surfaceMergingObjs[i].onRayEnter(ray);
      } else if (incidentType == 0) {
        // Equivalent to not intersecting with the obj (e.g. two interfaces overlap)
        //n1=n1;
      } else {
        // Situation that may cause bugs (e.g. incident on an edge point)
        // To prevent shooting the ray to a wrong direction, absorb the ray
        return {
          isAbsorbed: true,
          isUndefinedBehavior: true
        };
      }
    }

    // Negative modifier for working with negative indices of refraction
    var mod_neg = false;
    if (n1 < 0) {
      n1 = -n1;     // Flip n1 for compatibility with the following equations
      mod_neg = true;
    }

    var normal_len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    var normal_x = normal.x / normal_len;
    var normal_y = normal.y / normal_len;

    var ray_len = Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y));

    var ray_x = (ray.p2.x - ray.p1.x) / ray_len;
    var ray_y = (ray.p2.y - ray.p1.y) / ray_len;


    // Reference http://en.wikipedia.org/wiki/Snell%27s_law#Vector_form

    var cos1 = -normal_x * ray_x - normal_y * ray_y;
    var sq1 = 1 - n1 * n1 * (1 - cos1 * cos1);


    if (sq1 < 0) {
      // Total internal reflection
      ray.p1 = incidentPoint;
      if (this.noTotalInternalReflection) { // Disabling total internal reflection. For temp use w/ TO
        ray.p2 = geometry.point(incidentPoint.x + (incidentPoint.x - ray.p1.x), incidentPoint.y + (incidentPoint.y - ray.p1.y));
      } else { 
        ray.p2 = geometry.point(incidentPoint.x + ray_x + 2 * cos1 * normal_x, incidentPoint.y + ray_y + 2 * cos1 * normal_y);
        if (bodyMergingObj) {
          ray.bodyMergingObj = bodyMergingObj;
        }
      }
    } else {
      // Refraction
      var cos2 = Math.sqrt(sq1);

      if (this.partialReflect) {
        var R_s = Math.pow((n1 * cos1 - cos2) / (n1 * cos1 + cos2), 2);
        var R_p = Math.pow((n1 * cos2 - cos1) / (n1 * cos2 + cos1), 2);
      // Reference http://en.wikipedia.org/wiki/Fresnel_equations#Definitions_and_power_equations
      } else {
        var R_s = 0;
        var R_p = 0;
      }

      let newRays = [];
      let truncation = 0;

      // Handle the reflected ray
      var ray2 = geometry.line(incidentPoint, geometry.point(incidentPoint.x + ray_x + 2 * cos1 * normal_x, incidentPoint.y + ray_y + 2 * cos1 * normal_y));
      ray2.brightness_s = ray.brightness_s * R_s;
      ray2.brightness_p = ray.brightness_p * R_p;
      ray2.wavelength = ray.wavelength;
      ray2.gap = ray.gap;
      if (bodyMergingObj) {
        ray2.bodyMergingObj = bodyMergingObj;
      }
      if (ray2.brightness_s + ray2.brightness_p > (this.scene.colorMode != 'default' ? 1e-6 : 0.01)) {
        newRays.push(ray2);
      } else {
        truncation += ray2.brightness_s + ray2.brightness_p;
        if (!ray.gap && !this.scene.colorMode != 'default') {
          var amp = Math.floor(0.01 / (ray2.brightness_s + ray2.brightness_p)) + 1;
          if (rayIndex % amp == 0) {
            ray2.brightness_s = ray2.brightness_s * amp;
            ray2.brightness_p = ray2.brightness_p * amp;
            newRays.push(ray2);
          }
        }
      }

      // Handle the refracted ray

      // Handle negative refractive index
      if (mod_neg) {
        // Restore n1
        n1 = -n1;

        // Flip sign of cos2
        cos2 = Math.cos(2 * Math.PI - Math.acos(cos2));
      }

      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x + n1 * ray_x + (n1 * cos1 - cos2) * normal_x, incidentPoint.y + n1 * ray_y + (n1 * cos1 - cos2) * normal_y);
      ray.brightness_s = ray.brightness_s * (1 - R_s);
      ray.brightness_p = ray.brightness_p * (1 - R_p);

      if (ray.brightness_s + ray.brightness_p > (this.scene.colorMode != 'default' ? 1e-6 : 0)) {
        return {
          newRays: newRays,
          truncation: truncation
        };
      } else {
        return {
          isAbsorbed: true,
          newRays: newRays,
          truncation: truncation + ray.brightness_s + ray.brightness_p
        };
      }
    }
  }


  /**
   * Receives two points inside this lens, and returns the next point to where the ray, connecting these two points, will travel, based on the ray trajectory equation (equation 11.1 in the cited text below)
   * Using Euler's method to solve the ray trajectory equation (based on sections 11.1 and 11.2, in the following text: https://doi.org/10.1007/BFb0012092)
  x_der_s and x_der_s_prev are the x-coordinate derivatives with respect to the arc-length parameterization, at two different points (similarly for y_der_s and y_der_s_prev)
   * @param {Point} p1
   * @param {Point} p2
   * @param {Ray} ray
   */
  step(p1, p2, ray) {
    const point = [];

    var x = p2.x;
    var y = p2.y;
    console.log("step");
    var dist;

    if (this.toEnabled) {// && this.toNurbsSurfaceParams) {  // A more efficient way of doing this, e.g. changing which function is used at the moment toEnabled is set to true (or false), should be added eventually. Forsaken temporarily for testing and time constraints
      // Transformation optics functionality enabled
      // point.push(this.stepTO(p1, p2, ray));

      // if (p1.isUv && p2.isUv) {
        // Instead of going back and forth, just assume that the ray is in NURBS-space (i.e. uv), traveling in a straight line. We'll get the actual ray from what that u,v coordinate pair maps to.
        // const len = geometry.distance(p1, p2);
        // const x_der_s_prev = (p2.x - p1.x) / len;
        // point.push(geometry.point(x + this.stepSize * x_der_s_prev, y + this.stepSize * Math.sign(p2.y - p1.y) * Math.sqrt(1 - x_der_s_prev ** 2)));
        // point[0].isUv = true;
      // }
      // else if (!p1.isUv) {
      var p1_uv, p2_uv, p1_xy, p2_xy;
      const tmp_pt = new Vector3();
      // Temporarily doing if vector length of thepoint is < 1, since for points in UV-space, that should always be true. this should be changed as soon as possible, since otherwise it could cause unintentional consequences.
      if (!p1.isUv || geometry.length(p1) > 2) {
        console.log(geometry.length(p1))
        console.log(p1)
        const p1tmp = pointInversionXYZ(this.inversionTol / 10, this.inversionTol, this.maxIterations, new Vector3(p1.x, -p1.y, 0), 0.707, this.toNurbsSurfaceObj);
        p1_uv = {
          x: p1tmp.x,
          y: p1tmp.y,
          isUv: true
        }
        console.log("p1")
        console.log(p1tmp)
        p1_xy = {...p1};
      } else {
        p1_uv = {...p1};
        p1_uv.isUv = true;
        this.toNurbsSurfaceObj.getPoint(p1_uv.x, p1_uv.y, tmp_pt);
        p1_xy = geometry.point(tmp_pt.x + this.toNurbsSurfaceParams.nurbsPos.x, -tmp_pt.y - this.toNurbsSurfaceParams.nurbsPos.y);
      }

      if (!p2.isUv || geometry.length(p2) > 2) {
        const p2tmp = pointInversionXYZ(this.inversionTol / 10, this.inversionTol, this.maxIterations, new Vector3(p2.x, -p2.y, 0), 0.707, this.toNurbsSurfaceObj);
        console.log("p2")
        console.log(p2tmp)
        p2_uv = {
          x: p2tmp.x,
          y: p2tmp.y,
          isUv: true
        };
      } else {
        p2_uv = {...p2};
        p2_uv.isUv = true;
        this.toNurbsSurfaceObj.getPoint(p2.x, p2.y, tmp_pt);
        // x = tmp_pt.x + this.toNurbsSurfaceParams.nurbsPos;
        // y = -tmp_pt.y - this.toNurbsSurfaceParams.nurbsPos;
        p2_xy = geometry.point(tmp_pt.x + this.toNurbsSurfaceParams.nurbsPos.x, -tmp_pt.y - this.toNurbsSurfaceParams.nurbsPos.y);
      }
      // const len = geometry.distance(p1_uv, p2_uv);
      // const x_der_s_prev = (p2_uv.x - p1_uv.x) / len;
      // const y_der_s_prev = (p2_uv.y - p1_uv.y) / len;
      // point.push({
      //   x: p2_uv.x + this.stepSize * x_der_s_prev, 
      //   y: p2_uv.y + this.stepSize * y_der_s_prev, 
      //   // y: p2_uv.y + this.stepSize * Math.sign(p2_uv.y - p1_uv.y) * Math.sqrt(1 - x_der_s_prev ** 2),
      //   isUv: true
      // });
      const len = geometry.distance(p2_uv, p1_uv);
      point.push({
        x: p2_uv.x + this.uvStepSize * (p2_uv.x - p1_uv.x) / len,
        y: p2_uv.y + this.uvStepSize * (p2_uv.y - p1_uv.y) / len, 
        // y: p2_uv.y + this.stepSize * Math.sign(p2_uv.y - p1_uv.y) * Math.sqrt(1 - x_der_s_prev ** 2),
        isUv: true
      });
      console.log(point[0]);

      // Ignoring absorption for now
    } else {
      const len = geometry.distance(p1, p2);
      const x_der_s_prev = (p2.x - p1.x) / len;
      const y_der_s_prev = Math.sign(p2.y - p1.y) * Math.sqrt(1 - x_der_s_prev ** 2);

      const x_der_s = x_der_s_prev + this.stepSize * (ray.bodyMergingObj.fn_p_der_x({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * (1 - x_der_s_prev ** 2) - ray.bodyMergingObj.fn_p_der_y({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * x_der_s_prev * y_der_s_prev) / ray.bodyMergingObj.fn_p({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
      const y_der_s = y_der_s_prev + this.stepSize * (ray.bodyMergingObj.fn_p_der_y({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * (1 - y_der_s_prev ** 2) - ray.bodyMergingObj.fn_p_der_x({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH }) * x_der_s_prev * y_der_s_prev) / ray.bodyMergingObj.fn_p({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });

      const x_new = x + this.stepSize * x_der_s;
      const y_new = y + this.stepSize * y_der_s;

      point.push(geometry.point(x_new, y_new));

      // Absorption
      // const alpha = ray.bodyMergingObj.fn_alpha({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
      // const absorption = Math.exp(-alpha * this.stepSize);

      // ray.brightness_s *= absorption;
      // ray.brightness_p *= absorption;
    // }

    // Absorption

    

    if (this.toEnabled) {
      const tmp_pt = new Vector3();
      this.toNurbsSurfaceObj.getPoint(point[0].x, point[0].y, tmp_pt);
      // const absorption = Math.exp(-alpha * this.uvStepSize);  // Note: this should be changed eventually to actually be accurate. this is a temp fix which has not been thoroughly done for sake of time constraints
      const alpha = ray.bodyMergingObj.fn_alpha({ x: p2_xy.x, y: p2_xy.y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
      const absorption = Math.exp(-alpha * 0.1 * geometry.distance(p2_xy, geometry.point(tmp_pt.x + this.toNurbsSurfaceParams.nurbsPos.x, -tmp_pt.y - this.toNurbsSurfaceParams.nurbsPos.y)));  // Note: this should be changed eventually to actually be accurate. this is a temp fix which has not been thoroughly done for sake of time constraints

      ray.brightness_s *= absorption;
      ray.brightness_p *= absorption;
    } else {
      const alpha = ray.bodyMergingObj.fn_alpha({ x: x, y: y, z: ray.wavelength || Simulator.GREEN_WAVELENGTH });
      const absorption = Math.exp(-alpha * this.stepSize);

      ray.brightness_s *= absorption;
      ray.brightness_p *= absorption;
    }}

    return point[0];
  }

  /**
   * Takes two points in a lens and returns the next point to where the ray, connecting these two points, will travel, based on the math of transformation optics (https://doi.org/10.1002/lpor.201700034) and NURBS surfaces (https://doi.org/10.1007/978-3-642-59223-2).
   * Currently ignoring absorption.
   * Ref: https://doi.org/10.3390/app11030912, https://doi.org/10.1007/978-1-4471-4996-5
   * @param {Point} p1
   * @param {Point} p2
   * @param {Ray} ray
   */
  stepTO(p1_, p2_, ray) {

    // Subtract NURBS surface position
    // const p1 = geometry.point(p1_.x - this.toNurbsSurfaceParams.nurbsPos.x, p1_.y - this.toNurbsSurfaceParams.nurbsPos.y);
    // const p2 = geometry.point(p2_.x - this.toNurbsSurfaceParams.nurbsPos.x, p2_.y - this.toNurbsSurfaceParams.nurbsPos.y);
    // const p1 = p1_;
    // const p2 = p2_;

    // Flip y to align with NURBS coordinate space
    const p1 = geometry.point(p1_.x, -p1_.y);
    const p2 = geometry.point(p2_.x, -p2_.y);

    // Taken directly from step() above
    const len = geometry.distance(p1, p2);
    const x = p2.x - this.origin.x;
    const y = p2.y - this.origin.y;
    const x_der_s_prev = (p2.x - p1.x) / len;
    const y_der_s_prev = Math.sign(p2.y - p1.y) * Math.sqrt(1 - x_der_s_prev ** 2);

    const testingCase = 2;

    // Update NURBS surface instance
    if (!this.toNurbsSurfaceObj) {
      this.updateNURBSObj();
    }

    console.log("P1, P2, nurbsPos");
    console.log(p1);
    console.log(p2);
    console.log(this.toNurbsSurfaceParams.nurbsPos);

    const nd = 1; // Number of derivatives to calculate for each of the uv coords in the NURBS surface (i.e. d=1 => partial of u, partial of v, and partial of both)
    const tol = 0.0001; // tolerance for finding (u,v) which correlates to (x,y)
    const maxIterations = 60; // Maximum number of iterations for the process of finding u and v for the point (x,y)


    // Testing different methods of calculation of next point
    switch (testingCase) {
      case 0: {
        try {
          
          const surfaceDerivs = calcNURBSSurfaceDerivativesXYZ(p2, nd, tol, maxIterations, this.toNurbsSurfaceParams.nurbsPos, this.toNurbsSurfaceParams.nurbsParams, this.toNurbsSurfaceObj);

          const u = surfaceDerivs.uvCoords[0];
          const v = surfaceDerivs.uvCoords[1];

          // const s_ux = 1 / surfaceDerivs.derivs[1][0].x;
          // const s_uy = 1 / surfaceDerivs.derivs[1][0].y;
          // const s_vx = 1 / surfaceDerivs.derivs[0][1].x;
          // const s_vy = 1 / surfaceDerivs.derivs[0][1].y;
          const s_ux = surfaceDerivs.derivs[1][0].x;
          const s_uy = surfaceDerivs.derivs[1][0].y;
          const s_vx = surfaceDerivs.derivs[0][1].x;
          const s_vy = surfaceDerivs.derivs[0][1].y;

          const a = s_ux * s_ux + s_vx * s_vx;
          const b = s_ux * s_uy + s_vx * s_vy;
          // b = c => c is unnecessary calculation
          const d = s_uy * s_uy + s_vy * s_vy;

          // More efficient version of the calculation of the reciprocal of the determinant calculation, since b = c. Reciprocal is used since we're assuming permittivity outside of a lens = 1 and permittivity' = n'^2 => sqrt(permittivity) / det(A) = 1/det(A)
          const determinantRecip = 1 / Math.pow( s_ux * s_vx - s_uy * s_vy, 2 );

        // may be wrong--> still learning, is weird --> // These are the x and y components of the new refractive index (it's anisotropic, so is direction dependent => can be represented as x and y components)
          const n_x = determinantRecip * (a * x_der_s_prev + b * y_der_s_prev);
          const n_y = determinantRecip * (b * x_der_s_prev + d * y_der_s_prev);

          const nLen = Math.sqrt(n_x * n_x + n_y * n_y);
          const n = {
            x: n_x / nLen,
            y: n_y / nLen
          };

          return geometry.point(x + n.x * this.stepSize, y + n.y * this.stepSize);
        } catch (e) {
          console.error(e.toString());
          
          // return geometry.point((p2.x - p1.x) / len, (p2.y - p1.y) / len);
        }
        break;
      }
      case 1: {
        const surfacePoints = [
          pointInversionXYZ(tol / 2, tol, maxIterations, new Vector3(p1.x, p1.y, 0), 0.7, this.toNurbsSurfaceObj),
          pointInversionXYZ(tol / 2, tol, maxIterations, new Vector3(p2.x, p2.y, 0), 0.7, this.toNurbsSurfaceObj)
        ]

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const du = surfacePoints[1][0] - surfacePoints[0][0];
        const dv = surfacePoints[1][1] - surfacePoints[0][1];

        const dudx = du / dx;
        const dudy = du / dy;
        const dvdx = dv / dx;
        const dvdy = dv / dy;

        const a = dudx * dudx + dudy * dudy;
        const b = dudx * dvdx + dudy * dvdy;
        const d = dvdx * dvdx + dvdy * dvdy;

        const determinantRecip = 1 / Math.pow( dudx * dvdy - dudy * dvdx, 2 );const n_x = determinantRecip * (a * x_der_s_prev + b * y_der_s_prev);
        
        const n_y = determinantRecip * (b * x_der_s_prev + d * y_der_s_prev);

        const nLen = Math.sqrt(n_x * n_x + n_y * n_y);
        const n = {
          x: n_x / nLen,
          y: n_y / nLen
        };

        return geometry.point(x + n.x * this.stepSize, y + n.y * this.stepSize);



        break;
      }
      case 2: {
        // this.updateNURBSObj();
        const surfaceDerivsP1 = calcNURBSSurfaceDerivativesXYZ(new Vector3(p1.x, p1.y, 0), nd, tol, 100, this.toNurbsSurfaceParams.nurbsPos, this.toNurbsSurfaceParams.nurbsParams, this.toNurbsSurfaceObj);
        const surfaceDerivsP2 = calcNURBSSurfaceDerivativesXYZ(new Vector3(p2.x, p2.y, 0), nd, tol, 100, this.toNurbsSurfaceParams.nurbsPos, this.toNurbsSurfaceParams.nurbsParams, this.toNurbsSurfaceObj);
        
        // const du = surfaceDerivsP2.uvCoords[0] - surfaceDerivsP1.uvCoords[0];
        // const dv = surfaceDerivsP2.uvCoords[1] - surfaceDerivsP1.uvCoords[1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        console.log("Us and Vs");
        console.log(surfaceDerivsP1.uvCoords);
        console.log(surfaceDerivsP2.uvCoords);
        // console.log(surfaceDerivsP1.derivs[0][1]);
        // console.log(surfaceDerivsP1.derivs[1][0]);
        // console.log(surfaceDerivsP2.derivs[0][1]);
        // console.log(surfaceDerivsP2.derivs[1][0]);

        // Normalize surface derivatives for their use as basis vectors of surface space
        const lenUSDP1 = Math.sqrt(Math.pow(surfaceDerivsP1.derivs[1][0].x, 2) + Math.pow(surfaceDerivsP1.derivs[1][0].y, 2));
        const lenUSDP2 = Math.sqrt(Math.pow(surfaceDerivsP2.derivs[1][0].x, 2) + Math.pow(surfaceDerivsP2.derivs[1][0].y, 2));
        const lenVSDP1 = Math.sqrt(Math.pow(surfaceDerivsP1.derivs[0][1].x, 2) + Math.pow(surfaceDerivsP1.derivs[0][1].y, 2));
        const lenVSDP2 = Math.sqrt(Math.pow(surfaceDerivsP2.derivs[0][1].x, 2) + Math.pow(surfaceDerivsP2.derivs[0][1].y, 2));

        // // Basis vectors in surface space at p1 and p2
        const uHats = [
          geometry.point(surfaceDerivsP1.derivs[1][0].x / lenUSDP1, surfaceDerivsP1.derivs[1][0].y / lenUSDP1),
          geometry.point(surfaceDerivsP2.derivs[1][0].x / lenUSDP2, surfaceDerivsP2.derivs[1][0].y / lenUSDP2)
        ];
        const vHats = [
          geometry.point(surfaceDerivsP1.derivs[0][1].x / lenVSDP1, surfaceDerivsP1.derivs[0][1].y / lenVSDP1),
          geometry.point(surfaceDerivsP2.derivs[0][1].x / lenVSDP2, surfaceDerivsP2.derivs[0][1].y / lenVSDP2)
        ];
         

        // const du = uHats[0].x * dx + uHats[0].y * dy;
        // const dv = vHats[0].x * dx + vHats[0].y * dy;
        // const uThing = geometry.point(surfaceDerivsP2.derivs[0][1].x - surfaceDerivsP1.derivs[0][1].x, surfaceDerivsP2.derivs[0][1].y - surfaceDerivsP1.derivs[0][1].y);
        // const vThing = geometry.point(surfaceDerivsP2.derivs[1][0].x - surfaceDerivsP1.derivs[1][0].x, surfaceDerivsP2.derivs[1][0].y - surfaceDerivsP1.derivs[1][0].y);
        const du_ = surfaceDerivsP2.uvCoords[0] - surfaceDerivsP1.uvCoords[0];
        const dv_ = surfaceDerivsP2.uvCoords[1] - surfaceDerivsP1.uvCoords[1];

        const fdmuvBasesLen = Math.sqrt(du_ ** 2 + dv_ ** 2);
        const du = du_ / fdmuvBasesLen;
        const dv = dv_ / fdmuvBasesLen;

        console.log("AAAAA");
        console.log(du);
        console.log(dv);
        console.log(uHats);
        console.log(vHats);
        

        // Testing some refractive index shenanigans
        const s_ux = surfaceDerivsP2.derivs[1][0].x;
        const s_uy = surfaceDerivsP2.derivs[1][0].y;
        const s_vx = surfaceDerivsP2.derivs[0][1].x;
        const s_vy = surfaceDerivsP2.derivs[0][1].y;

        const a = s_ux * s_ux + s_vx * s_vx;
        const b = s_ux * s_uy + s_vx * s_vy;
        // b = c => c is unnecessary calculation
        const d = s_uy * s_uy + s_vy * s_vy;

        // If using quasi-orthogonal discrete coordinate transformation (DCT) where the requirements are satisfied, this is approximately n (doi:10.1007/978-1-4471-4996-5_7).
        // This assumes that the angles between uHat and vHat are approximately 90 degrees everywhere. 
        const n_dct = 1 / (s_ux * s_vx - s_vy * s_uy);

        // Another version, apparently is an effective average refractive index for anisotropic media
        const c = 3 * 10 ** 8;  // Speed of light
        const n_pendry = Math.sqrt(a * d) / c;

        console.log("refractive indices comparison");
        console.log(n_dct);
        console.log(n_pendry);


        
        console.log("Diff between r dot uhat and delta u:");
        console.log( du_ - ( surfaceDerivsP2.derivs[1][0].x * dx + surfaceDerivsP2.derivs[1][0].y * dy ) );
        // console.log(geometry.point(  ))


        // checking if inverse of uhat/vhat components is what we want instead
        // Note: Make sure to add check for divide by zero




        // Trying to fix the issue with step length being less than difference between uv of p2 and that of p3
        // prevStepLen = ??
        // if fdmuvBasesLen < tol
        //   du *= prevStepLen, likewise for dv

        // Get next ray segment going from p2 outwards which has same length in surface space as distance between p1 and p2 in surface space
        // const p3 = geometry.point(p2.x + du * uHats[1].x + dv * vHats[1].x, -(p2.y + dv * vHats[1].y + du * uHats[1].y));
        // const p3 = geometry.point(p2.x - this.toNurbsSurfaceParams.nurbsPos.x + du_ * uHats[1].x + dv_ * vHats[1].x, -(p2.y  - this.toNurbsSurfaceParams.nurbsPos.y + dv_ * vHats[1].y + du_ * uHats[1].y));
        // const p3 = geometry.point(p2.x + du_ * surfaceDerivsP2.derivs[1][0].x + dv_ * surfaceDerivsP2.derivs[0][1].x, - (p2.y + dv_ * surfaceDerivsP2.derivs[0][1].y + du_ * surfaceDerivsP2.derivs[1][0].y));
        
        // this one "works"
        const p3 = new Vector3();
        this.toNurbsSurfaceObj.getPoint(surfaceDerivsP2.uvCoords[0] + du_, surfaceDerivsP2.uvCoords[1] + dv_, p3);
        
        // Get a rough correction for the difference in position between p2 and the point on the NURBS surface found closest to p2 during the process of approximation of nearest point on the surface
        console.log("Diff w p2:");
        const p2__ = new Vector3();
        this.toNurbsSurfaceObj.getPoint(surfaceDerivsP2.uvCoords[0], surfaceDerivsP2.uvCoords[1], p2__);
        const p2Correction = geometry.point(p2__.x - p2.x + this.toNurbsSurfaceParams.nurbsPos.x, p2__.y - p2.y + this.toNurbsSurfaceParams.nurbsPos.y);
        console.log(p2Correction);

        // Check if the length of most recent ray is less than the margin of error from the aforementioned point-on-surface approximation
        if (((p3.x - p2.x + this.toNurbsSurfaceParams.nurbsPos.x) ** 2 + (-p3.y - this.toNurbsSurfaceParams.nurbsPos.y + p2.y) ** 2) < (p2Correction.x ** 2 + p2Correction.y ** 2)) {
          console.warn("BaseGrinGlass.stepTO: Warning! Length of ray step less than margin of error!");
        }
        console.log((p3.x - p2.x + this.toNurbsSurfaceParams.nurbsPos.x) ** 2 + (-p3.y - this.toNurbsSurfaceParams.nurbsPos.y + p2.y) ** 2);

        // const out = geometry.point(p3.x + this.toNurbsSurfaceParams.nurbsPos.x - p2Correction.x, -(p3.y + this.toNurbsSurfaceParams.nurbsPos.y - p2Correction.y));
        const out = geometry.point(p3.x + this.toNurbsSurfaceParams.nurbsPos.x - p2Correction.x, -p3.y - this.toNurbsSurfaceParams.nurbsPos.y + p2Correction.y);
        // const out = geometry.point(p3.x - p2Correction.x, -(p3.y - p2Correction.y));
        console.log("Out");
        console.log(out);
        console.log("P3");
        console.log(p3);
        return out;


        // if that doesn't work:



        break;
      }
      case 3: {

        const surfacePoints = [
          pointInversionXYZ(tol / 2, tol, 100, new Vector3(p1.x - this.toNurbsSurfaceParams.nurbsPos.x, p1.y - this.toNurbsSurfaceParams.nurbsPos.y, 0), 0.7, this.toNurbsSurfaceObj),
          pointInversionXYZ(tol / 2, tol, 100, new Vector3(p2.x - this.toNurbsSurfaceParams.nurbsPos.x, p2.y - this.toNurbsSurfaceParams.nurbsPos.y, 0), 0.7, this.toNurbsSurfaceObj)
        ];

        const uvLen = Math.sqrt(Math.pow(surfacePoints[1][0] - surfacePoints[0][0], 2) + Math.pow(surfacePoints[1][1] - surfacePoints[0][1], 2));

        const uHat = (surfacePoints[1][0] - surfacePoints[0][0]) / uvLen;
        // const dv = (surfacePoints[1][1] - surfacePoints[0][1]) / uvLen;
        const vHat = Math.sign(surfacePoints[1][1] - surfacePoints[0][1]) * Math.sqrt(1 - uHat ** 2);

        // const dx = p2.x - p1.x;
        // const dy = p2.y - p1.y;

        const p3u = surfacePoints[1][0] + uHat * this.stepSize;
        const p3v = surfacePoints[1][1] + vHat * this.stepSize;
        // const p3u = surfacePoints[1][0] + this.stepSize;
        // const p3v = surfacePoints[1][1] + this.stepSize;

        console.log("Case 3 u v");
        console.log(p3u);
        console.log(p3v);

        const p3 = new Vector3();
        this.toNurbsSurfaceObj.getPoint(p3u, p3v, p3);
        console.log("P3");
        console.log(p3);
        console.log("NurbsPos");
        console.log(this.toNurbsSurfaceParams.nurbsPos);

        // return geometry.point(p3.x - this.toNurbsSurfaceParams.nurbsPos.x, -p3.y + this.toNurbsSurfaceParams.nurbsPos.y);
        const out = geometry.point(p3.x + this.toNurbsSurfaceParams.nurbsPos.x, -p3.y - this.toNurbsSurfaceParams.nurbsPos.y);
        console.log("Out");
        console.log(out);
        return out;
      }
    }
    
    // old, broken

    // const incidentLen = geometry.distance(p1, p2);
    // const incidentUnitVec = {
    //   x: (p2.x - p1.x) / incidentLen,
    //   y: (p2.y - p1.y) / incidentLen
    // };
    
    // const b = partialU.x * partialU.y + partialV.x * partialV.y;
    // const transformationMatrix = [
    //   [
    //     Math.pow(partialU.x, 2) + Math.pow(partialV.x, 2),
    //     b
    //   ],
    //   [
    //     b,
    //     Math.pow(partialU.y, 2) + Math.pow(partialV.y, 2)
    //   ]
    // ];
    // const transformationMatrixInv = [
    //   [
    //     Math.pow(partialU.y, 2) + Math.pow(partialV.y, 2),
    //     -b
    //   ],
    //   [
    //     -b,
    //     Math.pow(partialU.x, 2) + Math.pow(partialV.x, 2)
    //   ]
    // ];
    // const determinant = transformationMatrix[0][0] * transformationMatrix[1][1] - Math.pow(b, 2);
    
    // // Assuming n outside the lens (i.e. where there is no lens) is equal to 1, and that permittivity is equal to permeability => n = sqrt(permittivity^2) = permittivity = 1
    // const refractedVec = {
    //   x: transformationMatrixInv[0][0] * incidentUnitVec.x - b * incidentUnitVec.y,
    //   y: -b * incidentUnitVec.x + transformationMatrixInv[1][1] * incidentUnitVec.y
    // };
    // console.log("Length of refracted vec: " + Number(Math.pow(refractedVec.x, 2) + Math.pow(refractedVec.y, 2)).toString());
    
    // return geometry.point(refractedVec.x + p1.x, refractedVec.y + p1.y);


  }

  /**
   * Update the local NURBS surface instance when toNurbsSurfaceParams is updated
   * @param {Object} nurbsParams_ - NURBS parameters in JSON format to be used in creation of SurfaceObject
   */
  updateNURBSObj() { 
    // try {
      // if (this.toNurbsSurfaceParams && this.toNurbsSurfaceParams.nurbsParams) {
      //   // this.toNurbsSurfaceParams.nurbsParams = nurbsParams;
      //   // this.toNurbsSurfaceObj = new SurfaceObject({ nurbsParams: this.toNurbsSurfaceParams.nurbsParams });   // Saved separately from the GUI one since the GUI one is overwritten a lot
      //   this.toNurbsSurfaceObj = new SurfaceObject({ nurbsParams: JSON.parse(JSON.stringify(this.toNurbsSurfaceParams.nurbsParams)) });   // Saved separately from the GUI one since the GUI one is overwritten a lot
      // } else {
      //   this.toNurbsSurfaceObj = new SurfaceObject({});
      // }
    // } catch (e) {
    //   console.error(e.toString());
    // }
    // Used to get points on the NURBS surface, given (u,v) coords. Can be done more efficiently using a custom implementation, but this has been skipped temporarily for sake of time.
    // try {
    //   this.toNurbsSurfaceObj = new SurfaceObject({ threeScene: this.basicScene, texturePath: '../img/uv_grid_opengl.jpg', geomResolution: 50})
      
    //   this.toNurbsSurfaceObj = new NURBSSurface( this.toNurbsSurfaceParams.nurbsParams.degree1, this.toNurbsSurfaceParams.nurbsParams.degree2, this.toNurbsSurfaceParams.nurbsParams.knots1, this.toNurbsSurfaceParams.nurbsParams.knots2, this.toNurbsSurfaceParams.nurbsParams.ctrlPts );
    // } catch (e) {
    //   console.error(e.toString());
    // }
  }
  
  // calcNURBSSurfaceDerivativesXYZ(point, d, tol, maxIt, nurbsPosition, nurbsParams, threeSurfaceObj) {
  //     const surfaceObj = {};
  //     if (!threeSurfaceObj) surfaceObj["obj"] = new NURBSSurface( nurbsParams.degree1, nurbsParams.degree2, nurbsParams.knots1, nurbsParams.knots2, nurbsParams.ctrlPts );
  //     else surfaceObj["obj"] = threeSurfaceObj;
  
  //     // Offset p by the nurbsObj's position
  //     const p = point.clone();
  //     p.sub(nurbsPosition);
  //     // console.log(p);
  
  //     const tol_ = tol || 0.000001;
  //     const minDistForUnitVectors = tol_ / 2;
  //     const maxIterations = maxIt || 60;
  //     const uvCoords = pointInversionXYZ(minDistForUnitVectors, tol_, maxIterations, p, 0.5, threeSurfaceObj );
  
  //     return calcNURBSSurfaceDerivatives(uvCoords[0], uvCoords[1], d, nurbsParams);
  // }




  /* Abstract methods */

  /**
   * Returns `true` if `point` is outside the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isOutsideGlass(point) {
    // To be implemented in subclasses.
  }

  /**
   * Returns `true` if `point` is inside the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isInsideGlass(point) {
    // To be implemented in subclasses.
  }

  /**
   * Returns `true` if `point` is on the boundary of the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isOnBoundary(point) {
    // To be implemented in subclasses.
  }

};

export default BaseGrinGlass;