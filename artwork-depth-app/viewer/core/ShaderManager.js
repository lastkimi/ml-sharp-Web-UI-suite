/**
 * ShaderManager - Manages WebGL shader compilation and program creation
 */
export class ShaderManager {
    constructor(gl) {
        this.gl = gl;
        this.programs = new Map();
    }

    /**
     * Compile a shader from source
     * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
     * @param {string} source - Shader source code
     * @returns {WebGLShader}
     */
    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${info}`);
        }

        return shader;
    }

    /**
     * Create a shader program from vertex and fragment shader sources
     * @param {string} name - Program name for caching
     * @param {string} vertexSource - Vertex shader source
     * @param {string} fragmentSource - Fragment shader source
     * @returns {WebGLProgram}
     */
    createProgram(name, vertexSource, fragmentSource) {
        if (this.programs.has(name)) {
            return this.programs.get(name);
        }

        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const info = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Program linking error: ${info}`);
        }

        // Clean up shaders (they're linked into the program)
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);

        this.programs.set(name, program);
        return program;
    }

    /**
     * Get uniform location
     * @param {WebGLProgram} program
     * @param {string} name
     * @returns {WebGLUniformLocation}
     */
    getUniformLocation(program, name) {
        return this.gl.getUniformLocation(program, name);
    }

    /**
     * Get attribute location
     * @param {WebGLProgram} program
     * @param {string} name
     * @returns {number}
     */
    getAttribLocation(program, name) {
        return this.gl.getAttribLocation(program, name);
    }

    /**
     * Clean up resources
     */
    dispose() {
        for (const program of this.programs.values()) {
            this.gl.deleteProgram(program);
        }
        this.programs.clear();
    }
}
