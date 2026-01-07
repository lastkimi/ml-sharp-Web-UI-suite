import { ShaderManager } from './ShaderManager.js';
import { BufferManager } from './BufferManager.js';
import { vertexShader, fragmentShader } from './shaders.js';

/**
 * Main WebGL 2.0 Renderer for 3D Gaussian Splatting
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            antialias: false,
            alpha: true,
            premultipliedAlpha: false
        });

        if (!this.gl) {
            throw new Error('WebGL 2.0 not supported');
        }

        this.shaderManager = new ShaderManager(this.gl);
        this.bufferManager = new BufferManager(this.gl);
        
        // Create shader program
        this.program = this.shaderManager.createProgram('splat', vertexShader, fragmentShader);
        
        // Get attribute and uniform locations
        this.initLocations();
        
        // Setup WebGL state
        this.setupGLState();
        
        // Rendering state
        this.splatCount = 0;
        this.sortedIndices = null;
        this.positionsData = null; // Store for sorting
        this.rawData = null; // Store all raw data for reordering
        
        // Quad geometry for instancing
        this.setupQuadGeometry();
    }

    initLocations() {
        const gl = this.gl;
        const program = this.program;

        // Attributes
        this.locations = {
            // Quad vertex
            position: gl.getAttribLocation(program, 'position'),
            
            // Per-instance attributes
            instancePosition: gl.getAttribLocation(program, 'instancePosition'),
            instanceRotation: gl.getAttribLocation(program, 'instanceRotation'),
            instanceScale: gl.getAttribLocation(program, 'instanceScale'),
            instanceColor: gl.getAttribLocation(program, 'instanceColor'),
            
            // Uniforms
            projection: gl.getUniformLocation(program, 'u_projection'),
            view: gl.getUniformLocation(program, 'u_view'),
            focal: gl.getUniformLocation(program, 'u_focal'),
            viewport: gl.getUniformLocation(program, 'u_viewport')
        };
    }

    setupGLState() {
        const gl = this.gl;
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);
        
        // Don't write depth for transparent objects (we sort manually)
        gl.depthMask(false);
        gl.disable(gl.DEPTH_TEST);  // We rely on back-to-front sorting
        
        // Clear color
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
    }

    setupQuadGeometry() {
        // Simple quad vertices (-0.5 to 0.5)
        const quadVertices = new Float32Array([
            -0.5, -0.5,
             0.5, -0.5,
             0.5,  0.5,
            -0.5,  0.5
        ]);
        
        this.bufferManager.uploadData('quad', this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);
    }

    /**
     * Set splat data (positions, rotations, scales, colors)
     * @param {Object} data - { positions, rotations, scales, colors }
     */
    setSplatData(data) {
        const gl = this.gl;
        
        this.splatCount = data.positions.length / 3;
        this.positionsData = data.positions; // Store for sorting
        this.rawData = data; // Store all data for reordering
        
        // Initialize sorted indices (identity)
        this.sortedIndices = new Uint32Array(this.splatCount);
        for (let i = 0; i < this.splatCount; i++) {
            this.sortedIndices[i] = i;
        }
        
        // Upload initial data
        this.updateBuffers();
    }
    
    updateBuffers() {
        const gl = this.gl;
        
        if (!this.rawData || !this.sortedIndices) return;
        
        // Reorder data based on sorted indices
        const reorderedPositions = new Float32Array(this.splatCount * 3);
        const reorderedRotations = new Float32Array(this.splatCount * 4);
        const reorderedScales = new Float32Array(this.splatCount * 3);
        const reorderedColors = new Float32Array(this.splatCount * 4);
        
        for (let i = 0; i < this.splatCount; i++) {
            const srcIdx = this.sortedIndices[i];
            
            // Positions
            reorderedPositions[3*i] = this.rawData.positions[3*srcIdx];
            reorderedPositions[3*i+1] = this.rawData.positions[3*srcIdx+1];
            reorderedPositions[3*i+2] = this.rawData.positions[3*srcIdx+2];
            
            // Rotations
            reorderedRotations[4*i] = this.rawData.rotations[4*srcIdx];
            reorderedRotations[4*i+1] = this.rawData.rotations[4*srcIdx+1];
            reorderedRotations[4*i+2] = this.rawData.rotations[4*srcIdx+2];
            reorderedRotations[4*i+3] = this.rawData.rotations[4*srcIdx+3];
            
            // Scales
            reorderedScales[3*i] = this.rawData.scales[3*srcIdx];
            reorderedScales[3*i+1] = this.rawData.scales[3*srcIdx+1];
            reorderedScales[3*i+2] = this.rawData.scales[3*srcIdx+2];
            
            // Colors
            reorderedColors[4*i] = this.rawData.colors[4*srcIdx];
            reorderedColors[4*i+1] = this.rawData.colors[4*srcIdx+1];
            reorderedColors[4*i+2] = this.rawData.colors[4*srcIdx+2];
            reorderedColors[4*i+3] = this.rawData.colors[4*srcIdx+3];
        }
        
        // Upload reordered data
        this.bufferManager.uploadData('positions', gl.ARRAY_BUFFER, reorderedPositions, gl.DYNAMIC_DRAW);
        this.bufferManager.uploadData('rotations', gl.ARRAY_BUFFER, reorderedRotations, gl.DYNAMIC_DRAW);
        this.bufferManager.uploadData('scales', gl.ARRAY_BUFFER, reorderedScales, gl.DYNAMIC_DRAW);
        this.bufferManager.uploadData('colors', gl.ARRAY_BUFFER, reorderedColors, gl.DYNAMIC_DRAW);
    }
    
    getPositions() {
        return this.positionsData;
    }

    /**
     * Update sorted indices (from sorter worker)
     * @param {Uint32Array} indices
     */
    updateSortedIndices(indices) {
        this.sortedIndices = indices;
        // Reorder buffers based on new sort
        this.updateBuffers();
    }

    /**
     * Render the scene
     * @param {Object} camera - { projection, view, focal, viewport }
     */
    render(camera) {
        const gl = this.gl;
        
        if (this.splatCount === 0) return;

        // Clear
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use program
        gl.useProgram(this.program);

        // Set uniforms
        gl.uniformMatrix4fv(this.locations.projection, false, camera.projection);
        gl.uniformMatrix4fv(this.locations.view, false, camera.view);
        gl.uniform2f(this.locations.focal, camera.focal[0], camera.focal[1]);
        gl.uniform2f(this.locations.viewport, camera.viewport[0], camera.viewport[1]);

        // Bind quad vertices
        const quadBuffer = this.bufferManager.getOrCreateBuffer('quad');
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

        // Bind instance attributes
        this.setupInstanceAttributes();

        // Draw instanced
        // Note: We're using sorted indices, so we need to reorder data or use indirect draw
        // For now, we'll draw all instances (sorting will be handled by reordering buffers)
        gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.splatCount);
    }

    setupInstanceAttributes() {
        const gl = this.gl;
        
        // Positions
        const posBuffer = this.bufferManager.getOrCreateBuffer('positions');
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.enableVertexAttribArray(this.locations.instancePosition);
        gl.vertexAttribPointer(this.locations.instancePosition, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.locations.instancePosition, 1);

        // Rotations
        const rotBuffer = this.bufferManager.getOrCreateBuffer('rotations');
        gl.bindBuffer(gl.ARRAY_BUFFER, rotBuffer);
        gl.enableVertexAttribArray(this.locations.instanceRotation);
        gl.vertexAttribPointer(this.locations.instanceRotation, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.locations.instanceRotation, 1);

        // Scales
        const scaleBuffer = this.bufferManager.getOrCreateBuffer('scales');
        gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer);
        gl.enableVertexAttribArray(this.locations.instanceScale);
        gl.vertexAttribPointer(this.locations.instanceScale, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.locations.instanceScale, 1);

        // Colors
        const colorBuffer = this.bufferManager.getOrCreateBuffer('colors');
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(this.locations.instanceColor);
        gl.vertexAttribPointer(this.locations.instanceColor, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(this.locations.instanceColor, 1);
    }

    /**
     * Resize canvas
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.shaderManager.dispose();
        this.bufferManager.dispose();
    }
}
