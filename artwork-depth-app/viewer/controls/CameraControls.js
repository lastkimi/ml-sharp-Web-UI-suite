/**
 * Camera Controls for 3D navigation
 */
import { Matrix } from '../math/Matrix.js';

export class CameraControls {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        
        // Camera state
        this.eye = [0, 0, 5];
        this.target = [0, 0, 0];
        this.up = [0, -1, 0]; // ML-Sharp coordinate system
        
        // Interaction state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.distance = 5;
        this.minDistance = 0.1;
        this.maxDistance = 100;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update camera
        this.updateCamera();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', () => this.onTouchEnd());
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        
        this.rotationY += dx * 0.01;
        this.rotationX += dy * 0.01;
        
        // Clamp rotation X
        this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        this.updateCamera();
    }

    onMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    onWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY * 0.001;
        this.distance *= (1 + delta);
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        
        this.updateCamera();
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1 && this.isDragging) {
            const dx = e.touches[0].clientX - this.lastMouseX;
            const dy = e.touches[0].clientY - this.lastMouseY;
            
            this.rotationY += dx * 0.01;
            this.rotationX += dy * 0.01;
            this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
            
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
            
            this.updateCamera();
        } else if (e.touches.length === 2) {
            // Pinch to zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (this.lastPinchDistance) {
                const scale = dist / this.lastPinchDistance;
                this.distance /= scale;
                this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
                this.updateCamera();
            }
            
            this.lastPinchDistance = dist;
        }
    }

    onTouchEnd() {
        this.isDragging = false;
        this.lastPinchDistance = null;
    }

    updateCamera() {
        // Compute eye position from spherical coordinates
        const x = Math.sin(this.rotationY) * Math.cos(this.rotationX);
        const y = Math.sin(this.rotationX);
        const z = Math.cos(this.rotationY) * Math.cos(this.rotationX);
        
        this.eye = [
            this.target[0] + x * this.distance,
            this.target[1] + y * this.distance,
            this.target[2] + z * this.distance
        ];
        
        // Update camera matrices
        this.camera.view = Matrix.lookAt(this.eye, this.target, this.up);
    }

    /**
     * Set camera to look at a specific point
     * @param {number[]} target
     */
    setTarget(target) {
        this.target = [...target];
        this.updateCamera();
    }

    /**
     * Set camera distance
     * @param {number} distance
     */
    setDistance(distance) {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
        this.updateCamera();
    }

    /**
     * Reset camera to default position
     */
    reset() {
        this.rotationX = 0;
        this.rotationY = 0;
        this.distance = 5;
        this.target = [0, 0, 0];
        this.updateCamera();
    }
}
