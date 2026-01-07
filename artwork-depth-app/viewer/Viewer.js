/**
 * Main 3DGS Viewer - Integrates all components
 */
import { Renderer } from './core/Renderer.js';
import { PLYLoader } from './loaders/PLYLoader.js';
import { CameraControls } from './controls/CameraControls.js';
import { Matrix } from './math/Matrix.js';

export class Viewer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            fov: options.fov || 60,
            near: options.near || 0.1,
            far: options.far || 500,
            ...options
        };

        // Initialize renderer
        this.renderer = new Renderer(canvas);
        
        // Initialize loader
        this.loader = new PLYLoader();
        
        // Camera state
        this.camera = {
            projection: null,
            view: Matrix.identity(),
            focal: [0, 0],
            viewport: [canvas.width, canvas.height]
        };
        
        // Initialize camera controls
        this.controls = new CameraControls(canvas, this.camera);
        
        // Sorter worker
        this.sorterWorker = null;
        this.isSorting = false;
        this.sortThreshold = 0.1; // Sort when camera moves this much
        
        // Animation state
        this.animationFrameId = null;
        this.isAnimating = false;
        
        // Update projection on resize
        this.updateProjection();
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Load a PLY file
     * @param {string|File} source - URL or File
     * @returns {Promise<void>}
     */
    async load(source) {
        // Load and parse
        const data = await this.loader.load(source);
        
        // Set splat data in renderer
        this.renderer.setSplatData({
            positions: data.positions,
            rotations: data.rotations,
            scales: data.scales,
            colors: data.colors
        });
        
        // Center camera on scene
        if (data.centroid) {
            this.controls.setTarget(data.centroid);
            this.controls.setDistance(5);
        }
        
        // Initialize sorter worker
        this.initSorterWorker();
        
        // Start rendering
        this.start();
    }

    async initSorterWorker() {
        if (this.sorterWorker) return;
        
        // Inline sorter worker code
        const SORTER_WORKER_CODE = `
self.onmessage = function(e) {
    const { positions, viewMatrix, projectionMatrix, vertexCount } = e.data;
    
    try {
        const viewDir = [-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]];
        const len = Math.sqrt(viewDir[0]*viewDir[0] + viewDir[1]*viewDir[1] + viewDir[2]*viewDir[2]);
        const invLen = 1.0 / len;
        const nViewDir = [viewDir[0]*invLen, viewDir[1]*invLen, viewDir[2]*invLen];
        
        const camPos = [
            -(viewMatrix[12]*viewMatrix[0] + viewMatrix[13]*viewMatrix[1] + viewMatrix[14]*viewMatrix[2]),
            -(viewMatrix[12]*viewMatrix[4] + viewMatrix[13]*viewMatrix[5] + viewMatrix[14]*viewMatrix[6]),
            -(viewMatrix[12]*viewMatrix[8] + viewMatrix[13]*viewMatrix[9] + viewMatrix[14]*viewMatrix[10])
        ];
        
        const depths = new Float32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            const x = positions[3*i] - camPos[0];
            const y = positions[3*i+1] - camPos[1];
            const z = positions[3*i+2] - camPos[2];
            depths[i] = x*nViewDir[0] + y*nViewDir[1] + z*nViewDir[2];
        }
        
        const sortedIndices = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) sortedIndices[i] = i;
        sortedIndices.sort((a, b) => depths[b] - depths[a]);
        
        self.postMessage({ success: true, indices: sortedIndices }, [sortedIndices.buffer]);
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
`;
        
        try {
            const blob = new Blob([SORTER_WORKER_CODE], { type: 'application/javascript' });
            this.sorterWorker = new Worker(URL.createObjectURL(blob));
            
            this.sorterWorker.onmessage = (e) => {
                const { success, indices } = e.data;
                if (success) {
                    this.renderer.updateSortedIndices(indices);
                }
                this.isSorting = false;
            };
        } catch (error) {
            console.warn('Failed to initialize sorter worker:', error);
        }
    }

    triggerSort() {
        if (this.isSorting || !this.sorterWorker || !this.renderer.getPositions()) return;
        
        this.isSorting = true;
        
        this.sorterWorker.postMessage({
            positions: this.renderer.getPositions(),
            viewMatrix: this.camera.view,
            projectionMatrix: this.camera.projection,
            vertexCount: this.renderer.splatCount
        });
    }

    updateProjection() {
        const aspect = this.canvas.width / this.canvas.height;
        const fovRad = (this.options.fov * Math.PI) / 180;
        
        this.camera.projection = Matrix.perspective(
            fovRad,
            aspect,
            this.options.near,
            this.options.far
        );
        
        // Compute focal length
        const fy = this.canvas.height / (2 * Math.tan(fovRad / 2));
        this.camera.focal = [fy, fy]; // Assuming square pixels
        
        this.camera.viewport = [this.canvas.width, this.canvas.height];
    }

    handleResize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.renderer.resize(this.canvas.width, this.canvas.height);
        this.updateProjection();
    }

    render() {
        // Update camera from controls
        this.controls.updateCamera();
        
        // Trigger sort if needed (throttled)
        if (!this.isSorting && this.sorterWorker) {
            // Simple threshold check - sort every N frames or on significant camera movement
            if (!this.lastSortFrame || (this.frameCount - this.lastSortFrame) > 10) {
                this.triggerSort();
                this.lastSortFrame = this.frameCount;
            }
        }
        
        // Render
        this.renderer.render(this.camera);
        
        this.frameCount = (this.frameCount || 0) + 1;
    }

    start() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        const animate = () => {
            if (!this.isAnimating) return;
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    stop() {
        this.isAnimating = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    dispose() {
        this.stop();
        this.renderer.dispose();
        this.loader.dispose();
        if (this.sorterWorker) {
            this.sorterWorker.terminate();
        }
    }
}
