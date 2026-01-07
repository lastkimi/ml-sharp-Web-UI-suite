/**
 * Simple Frustum Culling utility
 */
export class FrustumCuller {
    /**
     * Check if a point is inside the view frustum
     * @param {number[]} point - [x, y, z]
     * @param {Float32Array} viewProjMatrix - View-projection matrix
     * @returns {boolean}
     */
    static isPointVisible(point, viewProjMatrix) {
        // Transform point to clip space
        const x = point[0];
        const y = point[1];
        const z = point[2];
        const w = 1.0;
        
        const clipX = viewProjMatrix[0] * x + viewProjMatrix[4] * y + viewProjMatrix[8] * z + viewProjMatrix[12] * w;
        const clipY = viewProjMatrix[1] * x + viewProjMatrix[5] * y + viewProjMatrix[9] * z + viewProjMatrix[13] * w;
        const clipZ = viewProjMatrix[2] * x + viewProjMatrix[6] * y + viewProjMatrix[10] * z + viewProjMatrix[14] * w;
        const clipW = viewProjMatrix[3] * x + viewProjMatrix[7] * y + viewProjMatrix[11] * z + viewProjMatrix[15] * w;
        
        // Check if in NDC space [-1, 1]
        if (Math.abs(clipX) > Math.abs(clipW)) return false;
        if (Math.abs(clipY) > Math.abs(clipW)) return false;
        if (clipZ < -clipW || clipZ > clipW) return false;
        
        return true;
    }
}
