/**
 * BD 2025
 * 
 * Custom glass for use exploring 2D metamaterial lenses of various refractive indices
 * (which may be negative) and various shapes defined by curves (i.e. SVG cubic Bezier paths).
 * 
 * Built for use as a component in https://github.com/ricktu288/ray-optics Ray Optics Simulation.
 * Modeled after `GrinGlass.js`.
 */

import BaseGrinGlass from '../BaseGrinGlass.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import Snap from 'snapsvg';

/**
 * Gradient-index glass of shape defined by cubic Bezier curves
 * 
 * Tools -> Glass -> GRIN curved polygon
 * @class
 * @extends BaseGrinGlass
 * @memberof sceneObjs
 * @property {Array<Point>} path - The path which makes up the glass. Each point will be considered the (beginning or) endpoint of a cubic Bezier curve.
 * @property {Array<Point>} controlPoints - Control points for controlling the curvature of each curve.
 * @property {boolean} notDone - Whether the user is still drawing the glass.
 * @property {boolean} isDrawingNewCurve - Whether or not the user is currently plotting out the start and end of a new curve.
 * @property {string} refIndexFn - Refractive index function in x and y in LaTeX format
 * @property {Point} origin - The origin of the (x,y) coordinates used in the refractive index function.
 * @property {number} stepSize - The step size for the ray trajectory equation
 * @property {number} intersectTol - The epsilon for the intersection calculations ("intersect tolerance"?)
 */
class CurveGrinGlass extends BaseGrinGlass {
    static type = 'CurveGrinGlass';
    static isOptical = true;
    static supportsSurfaceMerging = true;
    static serializableDefaults = {
        path: [],
        controlPoints: [],
        notDone: false,
        refIndexFn: '0.5',
        origin: { x: 0, y: 0 },
        stepSize: 1,
        intersectTol: 1e-3
    };


    populateObjBar(objBar) {
        objBar.setTitle(i18next.t('main:tools.CurveGrinGlass.title'));
        super.populateObjBar(objBar);
    }

    draw(canvasRenderer, isAboveLight, isHovered) {
        const ctx = canvasRenderer.ctx;
        const ls = canvasRenderer.lengthScale;

        // Allow the user to draw the object
        if (this.notDone) {
            // Draw the first line, setting up for the rest of the lines
            if (this.path.length === 2 && this.path[0].x === this.path[1].x && this.path[0].y === this.path[1].y) {
              ctx.fillStyle = 'rgb(255,0,0)';
              ctx.fillRect(this.path[0].x - 1.5 * ls, this.path[0].y - 1.5 * ls, 3 * ls, 3 * ls);
              return;
            }

            // User not done drawing yet
            ctx.beginPath();
            ctx.moveTo(this.path[0].x, this.path[0].y);

            /*for (var i = 0; i < this.path.length - 1; i++) {
                ctx.bezierCurveTo(this.controlPoints[i].x, this.controlPoints[i].y, this.controlPoints[(i + 1)].x, this.controlPoints[(i + 1)].y, this.path[(i + 1)].x, this.path[(i + 1)].y);
            }*/
            for (var i = 0; i < this.path.length - 2; i += 2) {
                ctx.bezierCurveTo(this.controlPoints[i].x, this.controlPoints[i].y, this.controlPoints[(i + 1)].x, this.controlPoints[(i + 1)].y, this.path[(i + 1)].x, this.path[(i + 1)].y);
                ctx.moveTo(this.path[(i + 2)].x, this.path[(i + 2)].y);     // Go to the next starting point
            }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgb(200,200,200)';
            ctx.lineWidth = 1 * ls;
            ctx.stroke();
        } else {
            // The user has finished drawing the object
            ctx.beginPath();
            ctx.moveTo(this.path[0].x, this.path[0].y);

            // Double check to ensure controlPoints is twice the length of path. Otherwise, throw error.
            if (!(this.path.length * 2 === this.controlPoints.length)) {
                throw new Error("Invalid number of control points relative to number of path points.");
            }
            
            for (var i = 0; i < this.path.length; i += 2) {
                // The weird formatting below just makes it so that we can wrap around to the beginning of the array more easily for closing of the curve.
                ctx.bezierCurveTo(this.controlPoints[i].x, this.controlPoints[i].y, this.controlPoints[(i + 1) % this.controlPoints.length].x, this.controlPoints[(i + 1) % this.controlPoints.length].y, this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
                ctx.moveTo(this.path[(i + 2) % this.path.length].x, this.path[(i + 2) % this.path.length].y);     // Go to the next starting point
            }
            this.fillGlass(canvasRenderer, isAboveLight, isHovered);
        }
        ctx.lineWidth = 1;
    }

    // Handle filling the lens with color
    fillGlass(canvasRenderer, isAboveLight, isHovered) {
      const ctx = canvasRenderer.ctx;
  
      if (isAboveLight) {
        // Draw the highlight only
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = isHovered ? 'cyan' : ('transparent');
        ctx.fill('evenodd');
        ctx.globalAlpha = 1;
        return;
      }
      if (isHovered) {
        ctx.fillStyle = "rgba(200,200,200,0.22";
      } else {
        ctx.fillStyle = "rgba(200,0,200,0.18)";
      }
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
    }

    // Handle moving of the lens
    move(dx, dy) {
        for (var i = 0; i < this.path.length; i++) {
            this.path[i].x += dx;
            this.path[i].y += dy;
            this.controlPoints[i].x += dx;
            this.controlPoints[i].y += dy;
            this.controlPoints[i + 1].x += dx;
            this.controlPoints[i + 1].y += dy;
        }
    }

    onConstructMouseDown(mouse, ctrl, shift) {
        const mousePos = mouse.getPosSnappedToGrid();
        if (!this.notDone) {
            // Initialize construction stage
            this.notDone = true;
            this.path = [{ x: mousePos.x, y: mousePos.y }];
        }
        
        // Check if is end point of line
        if (this.path.length % 2 === 0) {
            // Add control points halfway between the two points
            this.controlPoints.push({ x: (this.path[this.path.length - 1].x + this.path[this.path.length - 2].x) / 2, y: (this.path[this.path.length - 1].y + this.path[this.path.length - 2].y) / 2 });
            this.controlPoints.push({ x: (this.path[this.path.length - 1].x + this.path[this.path.length - 2].x) / 2, y: (this.path[this.path.length - 1].y + this.path[this.path.length - 2].y) / 2 });
            this.isDrawingNewCurve = false;
        } else {
            // Otherwise, user is in the middle of drawing a new curve
            this.isDrawingNewCurve = true;
        }

        // Create a new point on the path
        this.path.push({ x: mousePos.x, y: mousePos.y });

        // Check if current point is closing the lens
        /**
         *  TODO: Change this initial check to be for whether or not a "Done" button has been clicked (instead of the existing check)
         */ 
        if (this.path.length > 3 && mouse.snapsOnPoint(this.path[0])) {
            // Go through and check if all of the curves are connected. 
            // Get count of occurrences of each point in the curve via use of a Map.
            const map = this.path.reduce((p, e) => p.set(e, (p.get(e) || 0) + 1), new Map());  
            const count = [...map.values()];
            // Temporarily set this.notDone to false. If we aren't done, then it should be set back to true below.
            this.notDone = false;
            for (var i = 0; i < count.length; i++) {
                // If all points have at least 2 occurrences, then we should be all set. 
                if (count[i] <= 1) {
                    // Otherwise, we're not done yet, so set this.notDone back to true.
                    this.notDone = true;
                }
            }
            // If so, the lens is done. Otherwise, continue drawing.
            
            this.path.length--;
            this.notDone = false;
            return {
                isDone: true
            };
        }
    }

    onConstructMouseMove(mouse, ctrl, shift) {
        if (this.isDrawingNewCurve) {
            const mousePos = mouse.getPosSnappedToGrid();
            this.path[this.path.length - 1] = {x: mousePos.x, y: mousePos.y };
        }
    }

    onConstructUndo() {
        if (this.path.length <= 2) {
            return {
                isCancelled: true
            };
        } else {
            // Check if in middle of drawing new curve
            if (this.isDrawingNewCurve) {
                this.path.pop();
            }
        }
    }
};

export default CurveGrinGlass;