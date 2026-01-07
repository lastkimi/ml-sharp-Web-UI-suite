/**
 * Quaternion utilities for rotation representation
 */
export class Quaternion {
    /**
     * Convert quaternion [w, x, y, z] to rotation matrix (3x3)
     * @param {number[]} q - Quaternion [w, x, y, z]
     * @returns {Float32Array} 3x3 rotation matrix (9 elements)
     */
    static toMatrix(q) {
        const [w, x, y, z] = q;
        const m = new Float32Array(9);
        
        m[0] = 1 - 2 * (y * y + z * z);
        m[1] = 2 * (x * y - z * w);
        m[2] = 2 * (x * z + y * w);
        m[3] = 2 * (x * y + z * w);
        m[4] = 1 - 2 * (x * x + z * z);
        m[5] = 2 * (y * z - x * w);
        m[6] = 2 * (x * z - y * w);
        m[7] = 2 * (y * z + x * w);
        m[8] = 1 - 2 * (x * x + y * y);
        
        return m;
    }
}
