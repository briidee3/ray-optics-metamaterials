/**
 * BD 2025
 * 
 * Custom mixin for use setting up GRIN glass bounded by curves (i.e. Cubic Bezier Splines).
 * Built for use with https://github.com/ricktu288/ray-optics Ray Optics Simulation.
 * Modeled after `CircleObjMixin.js`.
 */

import geometry from '../geometry.js';
import BaseSceneObj from './BaseSceneObj.js';
import Simulator from '../Simulator.js';
import { Bezier } from 'bezier-js';

/**
 * The mixin for the scene objects bounded by curves
 * @template {typeof BaseSceneObj} T
 * @param {T} Base
 * @returns {T}
 */
const CurveObjMixin = Base => class extends Base {

    move(diffX, diffY) {
        // Move the first point
        this.p1.x += diffX;
        this.p1.y += diffY;
        // Move the second point
        this.p2.x += diffX;
        this.p2.y += diffY;
        // Move the first control point
        this.c1.x += diffX;
        this.c1.y += diffY;
        // Move the second control point
        this.c2.x += diffX;
        this.c2.y += diffY;
        // Move the curve
        this.curve.points = [ this.p1, this.c1, this.c2, this.p2 ];
        this.curve.update();
    }
    
    onConstructMouseDown(mouse, ctrl, shift) {
        if (!this.constructionPoint) {
            // Initialize the construction stage.
            this.constructionPoint = mouse.getPosSnappedToGrid();
            this.p1 = this.constructionPoint;
            this.p2 = this.constructionPoint;
            this.c1 = this.constructionPoint;
            this.c2 = this.constructionPoint;
        }
        if (shift) {
            this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
        } else {
            this.p2 = mouse.getPosSnappedToGrid();
        }

        this.p1 = this.constructionPoint;
    }

    onConstructMouseMove(mouse, ctrl, shift) {
        if (shift) {
            this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
        } else {
            this.p2 = mouse.getPosSnappedToGrid();
        }

        this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;
    }

    onConstructMouseUp(mouse, ctrl, shift) {
        /*if (!this.constructionPoint) {
            // Initialize the construction stage.
            this.constructionPoint = mouse.getPosSnappedToGrid();
            this.p1 = this.constructionPoint;
            this.p2 = this.constructionPoint;
            this.c1 = this.constructionPoint;
            this.c2 = this.constructionPoint;
        }*/
        // Set control points to be in between both anchor points
        this.c1 = geometry.midpoint(this.p1, this.p2);
        this.c2 = this.c1;
        // Create Bezier curve object
        this.curve = new Bezier(geometry.point(this.p1.x, this.p1.y), geometry.point(this.c1.x, this.c1.y), geometry.point(this.c2.x, this.c2.y), geometry.point(this.p2.x, this.p2.y));

        if (!mouse.snapsOnPoint(this.p1)) {
            delete this.constructionPoint;
            return {
                isDone: true
            };
        }
    }

    checkMouseOver(mouse) {
        let dragContext = {};
        if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2)) {
            dragContext.part = 1;
            dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
            return dragContext;
        }
        if (mouse.isOnPoint(this.p2)) {
            dragContext.part = 2;
            dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
            return dragContext;
        }
        // Control point 1
        if (mouse.isOnPoint(this.c1)) {
            dragContext.part = 3;
            dragContext.targetPoint = geometry.point(this.c1.x, this.c1.y);
            return dragContext;
        }
        // Control point 2
        if (mouse.isOnPoint(this.c2)) {
            dragContext.part = 4; 
            dragContext.targetPoint = geometry.point(this.c2.x, this.c2.y);
            return dragContext;
        }
        if (mouse.isOnCurve(this.curve)) {
            const mousePos = mouse.getPosSnappedToGrid();
            dragContext.part = 0;
            dragContext.mousePos0 = mousePos;   // Mouse pos when user starts drag
            dragContext.mousePos1 = mousePos;   // Mouse pos when user ends drag
            dragContext.snapContext = {};
            return dragContext;
        }
    }

    onDrag(mouse, dragContext, ctrl, shift) {
        var basePoint;
        if (dragContext.part == 1) {
            // Drag first endpoint
            basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

            this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
            this.p2 = ctrl ? geometry.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
        }
        if (dragContext.part == 2) {
            // Drag second endpoint
            basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

            this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
            this.p1 = ctrl ? geometry.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
        }
        if (dragContext.part == 3) {
            // Drag first control point (no special behavior for shift or ctrl (for now))
            this.c1 = mouse.getPosSnappedToGrid();
        }
        if (dragContext.part == 3) {
            // Drag second control point (no special behavior for shift or ctrl (for now))
            this.c2 = mouse.getPosSnappedToGrid();
        }
        if (dragContext.part == 0) {
            // Dragging entire curve
            
            if (shift) {
                var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
            } else {
                var mousePos = mouse.getPosSnappedToGrid();
                dragContext.snapContext = {};   //Unlock dragging dir when release shift key
            }

            var mouseDiffX = dragContext.mousePos1.x - mousePos.x;  // X diff between mouse pos now and at prev moment
            var mouseDiffY = dragContext.mousePos1.y - mousePos.y;  // Y diff between mouse pos now and at prev moment
            // Move first control point
            this.c1.x -= mouseDiffX;
            this.c1.y -= mouseDiffY;
            // Move second control point
            this.c2.x -= mouseDiffX;
            this.c2.y -= mouseDiffY;
            // Move first point
            this.p1.x -= mouseDiffX;
            this.p1.y -= mouseDiffY;
            // Move second point
            this.p2.x -= mouseDiffX;
            this.p2.y -= mouseDiffY;
            // Move the curve
            this.curve.points = [ this.p1, this.p2, this.c1, this.c2 ];
            this.curve.update();
            // Update mouse position
            dragContext.mousePos1 = mousePos;
        }
    }

    /**
     * Check if ray intersects line segment.
     * In child class, can be called from `checkRayIntersects`.
     * @param {Ray} ray - The ray.
     * @returns {Point} The intersection point, or null if there is no intersection.
     */
    checkRayIntersectsShape(ray) {
        var rp_temp = this.curve.lineIntersects(geometry.line(ray.p1, ray.p2));

        if (rp_temp.length >= 1) {
            return this.curve.get(rp_temp[0]);
        } else {
            return null;
        }
    }
};

export default CurveObjMixin;