/**
 * Web Worker for parsing PLY files and converting ML-Sharp format
 * This runs in a separate thread to avoid blocking the main thread
 */

self.onmessage = function(e) {
    const { buffer, fileName } = e.data;
    
    try {
        // Parse PLY header
        const headerEnd = 'end_header\n';
        const headerArr = new Uint8Array(buffer);
        const chunk = new TextDecoder().decode(headerArr.slice(0, 2000));
        const endIdx = chunk.indexOf(headerEnd);
        
        if (endIdx === -1) {
            throw new Error('Invalid PLY: Header not found');
        }
        
        const bodyOffset = endIdx + headerEnd.length;
        const vertexMatch = chunk.match(/element vertex (\d+)/);
        
        if (!vertexMatch) {
            throw new Error('No vertex element found in PLY');
        }
        
        const vertexCount = parseInt(vertexMatch[1]);
        
        // Read binary data
        const srcData = new Float32Array(buffer.slice(bodyOffset));
        
        if (srcData.length < vertexCount * 14) {
            throw new Error(`Incomplete data. Expected ${vertexCount * 14} floats, got ${srcData.length}`);
        }
        
        // Allocate output arrays
        const positions = new Float32Array(vertexCount * 3);
        const rotations = new Float32Array(vertexCount * 4);
        const scales = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 4);
        
        // Conversion functions
        const sigmoid = (x) => 1 / (1 + Math.exp(-x));
        const C0 = 0.28209479177387814; // SH0 coefficient
        
        // Compute centroid for auto-centering
        let sumX = 0, sumY = 0, sumZ = 0;
        
        // Parse and convert
        for (let i = 0; i < vertexCount; i++) {
            const off = i * 14;
            
            // Position (x, y, z)
            const x = srcData[off];
            const y = srcData[off + 1];
            const z = srcData[off + 2];
            
            positions[3 * i] = x;
            positions[3 * i + 1] = y;
            positions[3 * i + 2] = z;
            
            sumX += x;
            sumY += y;
            sumZ += z;
            
            // Color (SH0 -> RGB)
            colors[4 * i] = srcData[off + 3] * C0 + 0.5;
            colors[4 * i + 1] = srcData[off + 4] * C0 + 0.5;
            colors[4 * i + 2] = srcData[off + 5] * C0 + 0.5;
            colors[4 * i + 3] = sigmoid(srcData[off + 6]); // Opacity (Logit -> Sigmoid)
            
            // Scale (Log -> Exp)
            scales[3 * i] = Math.exp(srcData[off + 7]);
            scales[3 * i + 1] = Math.exp(srcData[off + 8]);
            scales[3 * i + 2] = Math.exp(srcData[off + 9]);
            
            // Rotation (Quaternion) - ML-Sharp format is [w, x, y, z]
            rotations[4 * i] = srcData[off + 10];     // w
            rotations[4 * i + 1] = srcData[off + 11]; // x
            rotations[4 * i + 2] = srcData[off + 12]; // y
            rotations[4 * i + 3] = srcData[off + 13]; // z
        }
        
        const centroid = [
            sumX / vertexCount,
            sumY / vertexCount,
            sumZ / vertexCount
        ];
        
        // Send results back (using transferable objects for performance)
        self.postMessage({
            success: true,
            vertexCount,
            positions,
            rotations,
            scales,
            colors,
            centroid
        }, [
            positions.buffer,
            rotations.buffer,
            scales.buffer,
            colors.buffer
        ]);
        
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message
        });
    }
};
