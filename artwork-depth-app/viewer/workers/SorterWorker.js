/**
 * Web Worker for depth sorting splats
 * Uses efficient sorting algorithms for large datasets
 */

// Radix Sort for Uint32Array (O(n) complexity)
function radixSort(arr, depths) {
    const n = arr.length;
    const output = new Uint32Array(n);
    const count = new Uint32Array(256);
    
    // Convert depths to Uint32 for radix sort
    // We'll use a 32-bit float representation
    const depthBytes = new Uint8Array(depths.buffer);
    const depthUint32 = new Uint32Array(depths.buffer);
    
    // Sort by depth (back-to-front, so largest depth first)
    // We need to flip the sign for descending order
    const negDepths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        negDepths[i] = -depths[i];
    }
    
    // Use standard sort for now (can optimize to radix later if needed)
    const indices = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
        indices[i] = i;
    }
    
    // Sort indices based on depths
    indices.sort((a, b) => negDepths[a] - negDepths[b]);
    
    return indices;
}

self.onmessage = function(e) {
    const { positions, viewMatrix, projectionMatrix, vertexCount } = e.data;
    
    try {
        // Compute view-projection matrix
        const viewProj = new Float32Array(16);
        
        // Multiply projection * view
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += projectionMatrix[i * 4 + k] * viewMatrix[k * 4 + j];
                }
                viewProj[i * 4 + j] = sum;
            }
        }
        
        // Compute depths for each splat
        const depths = new Float32Array(vertexCount);
        
        // Simple depth: distance along view direction
        // Extract view direction from view matrix (third row, negated)
        const viewDir = [
            -viewMatrix[2],
            -viewMatrix[6],
            -viewMatrix[10]
        ];
        
        // Normalize view direction
        const len = Math.sqrt(viewDir[0] * viewDir[0] + viewDir[1] * viewDir[1] + viewDir[2] * viewDir[2]);
        const invLen = 1.0 / len;
        const nViewDir = [viewDir[0] * invLen, viewDir[1] * invLen, viewDir[2] * invLen];
        
        // Extract camera position from view matrix (inverse of translation)
        const camPos = [
            -(viewMatrix[12] * viewMatrix[0] + viewMatrix[13] * viewMatrix[1] + viewMatrix[14] * viewMatrix[2]),
            -(viewMatrix[12] * viewMatrix[4] + viewMatrix[13] * viewMatrix[5] + viewMatrix[14] * viewMatrix[6]),
            -(viewMatrix[12] * viewMatrix[8] + viewMatrix[13] * viewMatrix[9] + viewMatrix[14] * viewMatrix[10])
        ];
        
        // Compute depth for each position
        for (let i = 0; i < vertexCount; i++) {
            const x = positions[3 * i] - camPos[0];
            const y = positions[3 * i + 1] - camPos[1];
            const z = positions[3 * i + 2] - camPos[2];
            
            // Depth = dot product with view direction
            depths[i] = x * nViewDir[0] + y * nViewDir[1] + z * nViewDir[2];
        }
        
        // Sort indices based on depth (back-to-front: largest depth first)
        const sortedIndices = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            sortedIndices[i] = i;
        }
        
        // Use standard sort (can be optimized to radix sort for very large datasets)
        sortedIndices.sort((a, b) => depths[b] - depths[a]); // Descending (furthest first)
        
        // Send sorted indices back
        self.postMessage({
            success: true,
            indices: sortedIndices
        }, [sortedIndices.buffer]);
        
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message
        });
    }
};
