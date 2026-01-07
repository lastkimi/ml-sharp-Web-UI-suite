/**
 * BufferManager - Manages WebGL buffer creation and updates
 */
export class BufferManager {
    constructor(gl) {
        this.gl = gl;
        this.buffers = new Map();
    }

    /**
     * Create or get a buffer
     * @param {string} name - Buffer name
     * @param {number} usage - gl.STATIC_DRAW, gl.DYNAMIC_DRAW, etc.
     * @returns {WebGLBuffer}
     */
    getOrCreateBuffer(name, usage = this.gl.DYNAMIC_DRAW) {
        if (!this.buffers.has(name)) {
            const buffer = this.gl.createBuffer();
            this.buffers.set(name, { buffer, usage });
        }
        return this.buffers.get(name).buffer;
    }

    /**
     * Upload data to a buffer
     * @param {string} name - Buffer name
     * @param {number} target - gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER
     * @param {ArrayBufferView} data - Data to upload
     * @param {number} usage - Optional override of buffer usage
     */
    uploadData(name, target, data, usage = null) {
        const buffer = this.getOrCreateBuffer(name, usage || this.gl.DYNAMIC_DRAW);
        const bufferInfo = this.buffers.get(name);
        
        this.gl.bindBuffer(target, buffer);
        this.gl.bufferData(target, data, bufferInfo.usage);
    }

    /**
     * Update buffer data (assumes buffer already exists)
     * @param {string} name - Buffer name
     * @param {number} target - gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER
     * @param {ArrayBufferView} data - Data to upload
     * @param {number} offset - Byte offset
     */
    updateData(name, target, data, offset = 0) {
        const bufferInfo = this.buffers.get(name);
        if (!bufferInfo) {
            throw new Error(`Buffer ${name} does not exist`);
        }

        this.gl.bindBuffer(target, bufferInfo.buffer);
        this.gl.bufferSubData(target, offset, data);
    }

    /**
     * Delete a buffer
     * @param {string} name - Buffer name
     */
    deleteBuffer(name) {
        const bufferInfo = this.buffers.get(name);
        if (bufferInfo) {
            this.gl.deleteBuffer(bufferInfo.buffer);
            this.buffers.delete(name);
        }
    }

    /**
     * Clean up all buffers
     */
    dispose() {
        for (const [name, bufferInfo] of this.buffers) {
            this.gl.deleteBuffer(bufferInfo.buffer);
        }
        this.buffers.clear();
    }
}
