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

import * as C2S from 'canvas2svg';

/**
 * A class to render geometric figures from geometry.js on a canvas, and to handle the transformation and background image of the canvas.
 * @class
 */
class CanvasRenderer {
  constructor(ctx, origin, scale, lengthScale, backgroundImage, ctxVirtual) {

    /** @property {Object} ctx - The context of the canvas. */
    this.ctx = ctx;

    /** @property {Object} origin - The origin of the scene in the viewport. */
    this.origin = origin;

    /** @property {number} scale - The scale factor (the viewport physical pixel per internal length unit) of the scene. */
    this.scale = scale;

    /** @property {number} lengthScale - The scale factor of the length units of the scene. */
    this.lengthScale = lengthScale;

    /** @property {Object} canvas - The canvas of the scene. */
    this.canvas = ctx.canvas;

    /** @property {Object|null} backgroundImage - The background image of the scene, null if not set. */
    this.backgroundImage = backgroundImage;

    /** @property {CanvasRenderingContext2D} ctxVirtual - The virtual context for color adjustment. */
    this.ctxVirtual = ctxVirtual;

    if (typeof C2S !== 'undefined' && ctx.constructor === C2S) {
      /** @property {boolean} isSVG - Whether the canvas is being exported to SVG. */
      this.isSVG = true;
    }

    // Initialize the canvas
    if (!this.isSVG) {
      // only do this when not being exported to SVG to avoid bug
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.origin.x, this.origin.y);
      if (this.ctx.constructor !== C2S && this.backgroundImage) {
        this.ctx.globalAlpha = 1;
        this.ctx.drawImage(this.backgroundImage, 0, 0);
      }
    }
  }

  /**
   * Converts an RGBA array [R, G, B, A] with values between 0 and 1 to a CSS color string.
   * @param {number[]} rgba - The RGBA array.
   * @returns {string} The CSS color string.
   */
  rgbaToCssColor(rgba) {
    const [r, g, b, a] = rgba;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  }

  /**
   * Draw a point.
   * @param {Point} p
   * @param {number[]} [color=[0, 0, 0, 1]]
   * @param {number} [size=5]
   */
  drawPoint(p, color = [0, 0, 0, 1], size = 5) {
    this.ctx.fillStyle = this.rgbaToCssColor(color);
    this.ctx.fillRect(p.x - (size / 2) * this.lengthScale, p.y - (size / 2) * this.lengthScale, size * this.lengthScale, size * this.lengthScale);
  }

  /**
   * Draw a line.
   * @param {Line} l
   * @param {number[]} [color=[0, 0, 0, 1]]
   */
  drawLine(l, color = [0, 0, 0, 1]) {
    this.ctx.strokeStyle = this.rgbaToCssColor(color);
    this.ctx.lineWidth = 1 * this.lengthScale;
    this.ctx.beginPath();
    let ang1 = Math.atan2((l.p2.x - l.p1.x), (l.p2.y - l.p1.y));
    let cvsLimit = (Math.abs(l.p1.x + this.origin.x) + Math.abs(l.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
    this.ctx.moveTo(l.p1.x - Math.sin(ang1) * cvsLimit, l.p1.y - Math.cos(ang1) * cvsLimit);
    this.ctx.lineTo(l.p1.x + Math.sin(ang1) * cvsLimit, l.p1.y + Math.cos(ang1) * cvsLimit);
    this.ctx.stroke();
  }

  /**
   * Draw a ray.
   * @param {Line} r
   * @param {number[]} [color=[0, 0, 0, 1]]
   * @param {boolean} [showArrow=true]
   * @param {number[]} [lineDash=[]]
   */
  drawRay(r, color = [0, 0, 0, 1], showArrow = false, lineDash = []) {
    this.ctx.setLineDash(lineDash);
    this.ctx.strokeStyle = this.rgbaToCssColor(color);
    this.ctx.lineWidth = 1 * this.lengthScale;
    this.ctx.fillStyle = this.rgbaToCssColor(color);
    
    // Check if ray has a valid direction
    if (Math.abs(r.p2.x - r.p1.x) <= 1e-5 * this.lengthScale && Math.abs(r.p2.y - r.p1.y) <= 1e-5 * this.lengthScale) {
      return;
    }
    
    // Calculate direction vector and normalize it
    const dx = r.p2.x - r.p1.x;
    const dy = r.p2.y - r.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const unitX = dx / length;
    const unitY = dy / length;
    
    // Calculate canvas limit for ray length
    const cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
    
    // Calculate arrow size and position
    const arrowSize = 5 * this.lengthScale;
    const arrowDistance = 150 * this.lengthScale;  // Fixed distance from p1
    
    // Don't draw arrow if it would be too small compared to line width
    if (!showArrow || arrowSize < this.ctx.lineWidth * 1.2) {
      // Draw the ray without arrow
      this.ctx.beginPath();
      this.ctx.moveTo(r.p1.x, r.p1.y);
      this.ctx.lineTo(r.p1.x + unitX * cvsLimit, r.p1.y + unitY * cvsLimit);
      this.ctx.stroke();
      return;
    }
    
    // Draw first part of ray (from p1 to arrow)
    this.ctx.beginPath();
    this.ctx.moveTo(r.p1.x, r.p1.y);
    this.ctx.lineTo(r.p1.x + unitX * arrowDistance, r.p1.y + unitY * arrowDistance);
    this.ctx.stroke();
    
    // Calculate arrow points for trapezoid
    const arrowX = r.p1.x + unitX * arrowDistance;
    const arrowY = r.p1.y + unitY * arrowDistance;
    const baseWidth = this.ctx.lineWidth;
    const tipWidth = arrowSize;
    
    // Calculate perpendicular vector for width
    const perpX = -unitY;
    const perpY = unitX;
    
    // Draw arrow as trapezoid
    this.ctx.beginPath();
    // Front points of arrow (wide part)
    this.ctx.moveTo(
      arrowX - (tipWidth/2) * perpX,
      arrowY - (tipWidth/2) * perpY
    );
    this.ctx.lineTo(
      arrowX + (tipWidth/2) * perpX,
      arrowY + (tipWidth/2) * perpY
    );
    // Back of arrow (narrow part)
    this.ctx.lineTo(
      arrowX + arrowSize * unitX + (baseWidth/2) * perpX,
      arrowY + arrowSize * unitY + (baseWidth/2) * perpY
    );
    this.ctx.lineTo(
      arrowX + arrowSize * unitX - (baseWidth/2) * perpX,
      arrowY + arrowSize * unitY - (baseWidth/2) * perpY
    );
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw rest of ray (from arrow to infinity)
    this.ctx.beginPath();
    this.ctx.moveTo(arrowX + arrowSize * unitX, arrowY + arrowSize * unitY);
    this.ctx.lineTo(r.p1.x + unitX * cvsLimit, r.p1.y + unitY * cvsLimit);
    this.ctx.stroke();
  }

  /**
   * Draw a segment.
   * @param {Line} s
   * @param {number[]} [color=[0, 0, 0, 1]]
   * @param {boolean} [showArrow=true]
   * @param {number} [arrowPosition=0.67] Position of arrow along line (0 to 1, where 0 is at p1 and 1 is at p2)
   */
  drawSegment(s, color = [0, 0, 0, 1], showArrow = false, lineDash = []) {
    this.ctx.setLineDash(lineDash);
    this.ctx.strokeStyle = this.rgbaToCssColor(color);
    this.ctx.lineWidth = 1 * this.lengthScale;
    this.ctx.fillStyle = this.rgbaToCssColor(color);
    
    // Calculate arrow size first to determine if we should draw it
    const dx = s.p2.x - s.p1.x;
    const dy = s.p2.y - s.p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const arrowSize = Math.min(length * 0.15, 5 * this.lengthScale);
    const arrowPosition = 0.67;
    
    // Don't draw arrow if it would be too small compared to line width
    if (!showArrow || arrowSize < this.ctx.lineWidth * 1.2) {
      // Draw the line segment without arrow
      this.ctx.beginPath();
      this.ctx.moveTo(s.p1.x, s.p1.y);
      this.ctx.lineTo(s.p2.x, s.p2.y);
      this.ctx.stroke();
      return;
    }
    
    // Calculate direction vector and normalize it
    const unitX = dx / length;
    const unitY = dy / length;
    
    // Calculate arrow position
    const arrowX = s.p1.x + dx * arrowPosition;
    const arrowY = s.p1.y + dy * arrowPosition;
    
    // Draw first part of line (from p1 to arrow)
    this.ctx.beginPath();
    this.ctx.moveTo(s.p1.x, s.p1.y);
    this.ctx.lineTo(arrowX - arrowSize/2 * unitX, arrowY - arrowSize/2 * unitY);
    this.ctx.stroke();
    
    // Calculate arrow points for trapezoid
    const baseWidth = this.ctx.lineWidth;  // Use existing line width
    const tipWidth = arrowSize;  // Width at the front of arrow
    
    // Calculate perpendicular vector for width
    const perpX = -unitY;
    const perpY = unitX;
    
    // Draw arrow as trapezoid
    this.ctx.beginPath();
    // Front points of arrow (wide part)
    this.ctx.moveTo(
      arrowX - arrowSize/2 * unitX - (tipWidth/2) * perpX,
      arrowY - arrowSize/2 * unitY - (tipWidth/2) * perpY
    );
    this.ctx.lineTo(
      arrowX - arrowSize/2 * unitX + (tipWidth/2) * perpX,
      arrowY - arrowSize/2 * unitY + (tipWidth/2) * perpY
    );
    // Back of arrow (narrow part)
    this.ctx.lineTo(
      arrowX + arrowSize/2 * unitX + (baseWidth/2) * perpX,
      arrowY + arrowSize/2 * unitY + (baseWidth/2) * perpY
    );
    this.ctx.lineTo(
      arrowX + arrowSize/2 * unitX - (baseWidth/2) * perpX,
      arrowY + arrowSize/2 * unitY - (baseWidth/2) * perpY
    );
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw second part of line (from arrow to p2)
    this.ctx.beginPath();
    this.ctx.moveTo(arrowX + arrowSize/2 * unitX, arrowY + arrowSize/2 * unitY);
    this.ctx.lineTo(s.p2.x, s.p2.y);
    this.ctx.stroke();
  }

  /**
   * Draw a Bezier curve.
   * @param {Curve} c
   * @param {number[]} [color=[0, 0, 0, 1]]
   */
  drawCurve(c, color = [0, 0, 0, 1]) {
    this.ctx.strokeStyle = this.rgbaToCssColor(color);
    this.ctx.lineWidth = 1 * this.lengthScale;
    this.ctx.fillStyle = this.rgbaToCssColor(color);

    // Draw the curve
    this.ctx.beginPath();
    this.ctx.moveTo(c.p1.x, c.p1.y);
    this.ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p2.x, c.p2.y);
    this.ctx.stroke();
  }

  /**
   * Draw a circle.
   * @param {Circle} c
   * @param {String} [color='black']
   */
  drawCircle(c, color = 'black') {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1 * this.lengthScale;
    this.ctx.beginPath();
    if (typeof c.r === 'object') {
      let dx = c.r.p1.x - c.r.p2.x;
      let dy = c.r.p1.y - c.r.p2.y;
      this.ctx.arc(c.c.x, c.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
    } else {
      this.ctx.arc(c.c.x, c.c.y, c.r, 0, Math.PI * 2, false);
    }
    this.ctx.stroke();
  }

  /**
   * Apply color transformation to simulate 'lighter' composition with less color saturation.
   */
  applyColorTransformation() {
    this.ctxVirtual.canvas.width = this.canvas.width;
    this.ctxVirtual.canvas.height = this.canvas.height;
    this.ctxVirtual.drawImage(this.canvas, 0, 0);

    const imageData = this.ctxVirtual.getImageData(0, 0, this.ctxVirtual.canvas.width, this.ctxVirtual.canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // Skip transparent pixels
      const a0 = data[i + 3] / 256;
      const R = -Math.log(1 - (data[i] / 256)) * a0;
      const G = -Math.log(1 - (data[i + 1] / 256)) * a0;
      const B = -Math.log(1 - (data[i + 2] / 256)) * a0;
      const factor = Math.max(R, G, B);
      data[i] = 255 * R / factor;
      data[i + 1] = 255 * G / factor;
      data[i + 2] = 255 * B / factor;
      data[i + 3] = 255 * Math.min(factor, 1);
    }
    this.ctxVirtual.putImageData(imageData, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.ctxVirtual.canvas, 0, 0);
  }
}

export default CanvasRenderer;