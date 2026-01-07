/**
 * PLY File Loader with Web Worker support
 */

// Inline worker code (embedded as string)
const PARSER_WORKER_CODE = `
self.onmessage = function(e) {
    const { buffer, fileName } = e.data;
    
    try {
        const headerEnd = 'end_header\\n';
        const headerArr = new Uint8Array(buffer);
        const chunk = new TextDecoder().decode(headerArr.slice(0, 2000));
        const endIdx = chunk.indexOf(headerEnd);
        
        if (endIdx === -1) {
            throw new Error('Invalid PLY: Header not found');
        }
        
        const bodyOffset = endIdx + headerEnd.length;
        const vertexMatch = chunk.match(/element vertex (\\d+)/);
        
        if (!vertexMatch) {
            throw new Error('No vertex element found in PLY');
        }
        
        const vertexCount = parseInt(vertexMatch[1]);
        const srcData = new Float32Array(buffer.slice(bodyOffset));
        
        if (srcData.length < vertexCount * 14) {
            throw new Error(\`Incomplete data. Expected \${vertexCount * 14} floats, got \${srcData.length}\`);
        }
        
        const positions = new Float32Array(vertexCount * 3);
        const rotations = new Float32Array(vertexCount * 4);
        const scales = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 4);
        
        const sigmoid = (x) => 1 / (1 + Math.exp(-x));
        const C0 = 0.28209479177387814;
        
        let sumX = 0, sumY = 0, sumZ = 0;
        
        for (let i = 0; i < vertexCount; i++) {
            const off = i * 14;
            const x = srcData[off];
            const y = srcData[off + 1];
            const z = srcData[off + 2];
            
            positions[3 * i] = x;
            positions[3 * i + 1] = y;
            positions[3 * i + 2] = z;
            
            sumX += x; sumY += y; sumZ += z;
            
            colors[4 * i] = srcData[off + 3] * C0 + 0.5;
            colors[4 * i + 1] = srcData[off + 4] * C0 + 0.5;
            colors[4 * i + 2] = srcData[off + 5] * C0 + 0.5;
            colors[4 * i + 3] = sigmoid(srcData[off + 6]);
            
            scales[3 * i] = Math.exp(srcData[off + 7]);
            scales[3 * i + 1] = Math.exp(srcData[off + 8]);
            scales[3 * i + 2] = Math.exp(srcData[off + 9]);
            
            rotations[4 * i] = srcData[off + 10];
            rotations[4 * i + 1] = srcData[off + 11];
            rotations[4 * i + 2] = srcData[off + 12];
            rotations[4 * i + 3] = srcData[off + 13];
        }
        
        const centroid = [sumX / vertexCount, sumY / vertexCount, sumZ / vertexCount];
        
        self.postMessage({
            success: true,
            vertexCount,
            positions,
            rotations,
            scales,
            colors,
            centroid
        }, [positions.buffer, rotations.buffer, scales.buffer, colors.buffer]);
        
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
`;

export class PLYLoader {
    constructor() {
        this.parserWorker = null;
    }

    /**
     * Load PLY file from URL or File
     * @param {string|File} source - URL or File object
     * @returns {Promise<Object>} Parsed splat data
     */
    async load(source) {
        // Create worker if needed (inline worker)
        if (!this.parserWorker) {
            const blob = new Blob([PARSER_WORKER_CODE], { type: 'application/javascript' });
            this.parserWorker = new Worker(URL.createObjectURL(blob));
        }

        // Get buffer
        let buffer;
        if (source instanceof File) {
            buffer = await source.arrayBuffer();
        } else {
            const response = await fetch(source);
            buffer = await response.arrayBuffer();
        }

        // Parse in worker
        return new Promise((resolve, reject) => {
            this.parserWorker.onmessage = (e) => {
                const { success, error, ...data } = e.data;
                if (success) {
                    resolve(data);
                } else {
                    reject(new Error(error));
                }
            };

            this.parserWorker.onerror = (error) => {
                reject(error);
            };

            this.parserWorker.postMessage({
                buffer,
                fileName: source instanceof File ? source.name : source
            });
        });
    }

    /**
     * Clean up worker
     */
    dispose() {
        if (this.parserWorker) {
            this.parserWorker.terminate();
            this.parserWorker = null;
        }
    }
}
