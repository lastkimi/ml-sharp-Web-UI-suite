/**
 * Matrix utilities for 3D transformations
 */
export class Matrix {
    /**
     * Create a 4x4 identity matrix
     * @returns {Float32Array}
     */
    static identity() {
        const m = new Float32Array(16);
        m[0] = m[5] = m[10] = m[15] = 1.0;
        return m;
    }

    /**
     * Create a perspective projection matrix
     * @param {number} fov - Field of view in radians
     * @param {number} aspect - Aspect ratio (width/height)
     * @param {number} near - Near plane
     * @param {number} far - Far plane
     * @returns {Float32Array}
     */
    static perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const nf = 1 / (near - far);

        const m = new Float32Array(16);
        m[0] = f / aspect;
        m[5] = f;
        m[10] = (far + near) * nf;
        m[11] = -1;
        m[14] = (2 * far * near) * nf;
        return m;
    }

    /**
     * Create a look-at view matrix
     * @param {number[]} eye - Camera position [x, y, z]
     * @param {number[]} target - Look-at target [x, y, z]
     * @param {number[]} up - Up vector [x, y, z]
     * @returns {Float32Array}
     */
    static lookAt(eye, target, up) {
        const zx = eye[0] - target[0];
        const zy = eye[1] - target[1];
        const zz = eye[2] - target[2];
        const len = 1 / Math.sqrt(zx * zx + zy * zy + zz * zz);
        const z0 = zx * len;
        const z1 = zy * len;
        const z2 = zz * len;

        const xx = up[1] * z2 - up[2] * z1;
        const xy = up[2] * z0 - up[0] * z2;
        const xz = up[0] * z1 - up[1] * z0;
        const len2 = 1 / Math.sqrt(xx * xx + xy * xy + xz * xz);
        const x0 = xx * len2;
        const x1 = xy * len2;
        const x2 = xz * len2;

        const y0 = z1 * x2 - z2 * x1;
        const y1 = z2 * x0 - z0 * x2;
        const y2 = z0 * x1 - z1 * x0;

        const m = new Float32Array(16);
        m[0] = x0;
        m[1] = y0;
        m[2] = z0;
        m[3] = 0;
        m[4] = x1;
        m[5] = y1;
        m[6] = z1;
        m[7] = 0;
        m[8] = x2;
        m[9] = y2;
        m[10] = z2;
        m[11] = 0;
        m[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
        m[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
        m[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
        m[15] = 1;
        return m;
    }

    /**
     * Multiply two 4x4 matrices
     * @param {Float32Array} a
     * @param {Float32Array} b
     * @returns {Float32Array}
     */
    static multiply(a, b) {
        const m = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                m[i * 4 + j] = 
                    a[i * 4 + 0] * b[0 * 4 + j] +
                    a[i * 4 + 1] * b[1 * 4 + j] +
                    a[i * 4 + 2] * b[2 * 4 + j] +
                    a[i * 4 + 3] * b[3 * 4 + j];
            }
        }
        return m;
    }

    /**
     * Extract 3x3 matrix from 4x4 (upper-left)
     * @param {Float32Array} m4x4
     * @returns {Float32Array} 3x3 matrix (9 elements)
     */
    static extract3x3(m4x4) {
        const m = new Float32Array(9);
        m[0] = m4x4[0]; m[1] = m4x4[1]; m[2] = m4x4[2];
        m[3] = m4x4[4]; m[4] = m4x4[5]; m[5] = m4x4[6];
        m[6] = m4x4[8]; m[7] = m4x4[9]; m[8] = m4x4[10];
        return m;
    }
}
