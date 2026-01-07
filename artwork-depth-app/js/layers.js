import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.0/dist/transformers.min.js';

// Configuration
const MODEL_ID = 'Xenova/depth-anything-small-hf';
env.allowLocalModels = false;

// Globals
let depthEstimator = null;
let bodyPixNet = null; // New BodyPix Net
let scene, camera, renderer;
let bgMesh, fgMesh;
let isMobile = false;
let targetRotation = { x: 0, y: 0 };
let currentRotation = { x: 0, y: 0 };

// UI
const statusText = document.getElementById('status-text');
const progressFill = document.getElementById('progress-fill');
const loadingOverlay = document.getElementById('loading-overlay');

// 1. Init
async function init() {
    initThreeJS();
    setupInteraction();
    
    try {
        // Load Depth Model
        statusText.textContent = "1/2 正在下载深度模型 (30MB)...";
        depthEstimator = await pipeline('depth-estimation', MODEL_ID, {
            progress_callback: (progress) => {
                if (progress.status === 'progress') {
                    const p = Math.round((progress.progress || 0) * 0.5); // First half of bar
                    progressFill.style.width = `${p}%`;
                }
            }
        });
        
        // Load BodyPix Model
        statusText.textContent = "2/2 正在下载分割模型...";
        bodyPixNet = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        progressFill.style.width = `100%`;
        
        statusText.textContent = "准备就绪";
        loadDefaultImage();
    } catch (err) {
        console.error(err);
        alert("模型加载失败");
    }
}

// 2. Three.js
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = 2.5;
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);
    
    animate();
}

// 3. Core Processing
async function processImage(originalImg) {
    loadingOverlay.classList.remove('hidden');
    console.log("Processing started...");
    
    // 0. Resize Image for Performance (Max 1024px)
    // Large images crash BodyPix and WebGL textures
    const img = resizeImage(originalImg, 1024);
    console.log(`Resized image to ${img.width}x${img.height}`);
    
    statusText.textContent = "1/4 生成深度图...";
    progressFill.style.width = "20%";
    
    // Cleanup old
    if(bgMesh) scene.remove(bgMesh);
    if(fgMesh) scene.remove(fgMesh);
    
    try {
        // A. Depth
        console.log("Running Depth Estimation...");
        const depthOutput = await depthEstimator(img.src);
        // depth-estimation pipeline returns an object. 
        // We need to ensure we get a canvas out of it.
        // Transformers.js depth output is usually { depth: RawImage, ... }
        const depthCanvas = depthOutput.depth.toCanvas(); 
        console.log("Depth map generated.");
        
        statusText.textContent = "2/4 分离前景与背景...";
        progressFill.style.width = "40%";
        
        // B. Segmentation & Splitting
        console.log("Running BodyPix Segmentation...");
        const { fgCanvas, bgCanvas, maskCanvas } = await segmentImage(img, depthCanvas);
        console.log("Segmentation complete.");
        
        statusText.textContent = "3/4 智能修复背景...";
        progressFill.style.width = "70%";
        
        // C. Inpainting Background
        console.log("Running Inpainting...");
        const inpaintedBgCanvas = inpaintBackground(bgCanvas, maskCanvas);
        console.log("Inpainting complete.");
        
        statusText.textContent = "4/4 构建3D场景...";
        progressFill.style.width = "90%";
        
        // D. Build Meshes
        buildScene(img, depthCanvas, fgCanvas, inpaintedBgCanvas);
        console.log("Scene built.");
        
        loadingOverlay.classList.add('hidden');
    } catch (error) {
        console.error("Processing Pipeline Failed:", error);
        alert(`处理失败: ${error.message}`);
        loadingOverlay.classList.add('hidden');
    }
}

function resizeImage(img, maxDim) {
    let w = img.width;
    let h = img.height;
    if (w <= maxDim && h <= maxDim) return img;
    
    let scale = Math.min(maxDim / w, maxDim / h);
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    const newImg = new Image();
    newImg.src = canvas.toDataURL();
    newImg.width = canvas.width;
    newImg.height = canvas.height;
    return newImg;
}

// Segmentation using BodyPix (Better Person Detection)
async function segmentImage(img, depthCanvas) {
    const w = img.width;
    const h = img.height;
    
    // 1. Run BodyPix Inference
    // Ensure we await this!
    const segmentation = await bodyPixNet.segmentPerson(img, {
        internalResolution: 'medium', // Trade-off speed/accuracy
        segmentationThreshold: 0.7,
        maxDetections: 1 // Only 1 person usually
    });
    
    // Verify dimensions
    if (segmentation.width !== w || segmentation.height !== h) {
        console.warn(`Segmentation mask dimension mismatch! Mask: ${segmentation.width}x${segmentation.height}, Img: ${w}x${h}`);
        // We might need to handle this, but BodyPix usually matches input unless resize logic is flawed.
        // If mismatched, the loop below will fail or produce garbage.
    }
    
    // 2. Prepare Canvases
    const fgCvs = document.createElement('canvas'); fgCvs.width = w; fgCvs.height = h;
    const fgCtx = fgCvs.getContext('2d');
    const fgData = fgCtx.createImageData(w, h);
    
    const bgCvs = document.createElement('canvas'); bgCvs.width = w; bgCvs.height = h;
    const bgCtx = bgCvs.getContext('2d');
    const bgData = bgCtx.createImageData(w, h);
    
    const maskCvs = document.createElement('canvas'); maskCvs.width = w; maskCvs.height = h;
    const maskCtx = maskCvs.getContext('2d');
    const maskData = maskCtx.createImageData(w, h);
    
    // Draw original image to get data
    const tempCvs = document.createElement('canvas'); tempCvs.width = w; tempCvs.height = h;
    const tCtx = tempCvs.getContext('2d');
    tCtx.drawImage(img, 0, 0, w, h); // Ensure draw matches size
    const imgData = tCtx.getImageData(0, 0, w, h);
    
    // 3. Split based on BodyPix Mask
    const len = imgData.data.length;
    for (let i = 0; i < len; i += 4) {
        // segmentation.data is 1 for person, 0 for background
        // BodyPix data is row-major.
        const pixelIndex = i / 4;
        const isPerson = segmentation.data[pixelIndex];
        
        if (isPerson) {
            // Foreground
            fgData.data[i] = imgData.data[i];
            fgData.data[i+1] = imgData.data[i+1];
            fgData.data[i+2] = imgData.data[i+2];
            fgData.data[i+3] = 255;
            
            // Background Hole
            bgData.data[i] = 0;
            bgData.data[i+1] = 0;
            bgData.data[i+2] = 0;
            bgData.data[i+3] = 0;
            
            // Mask
            maskData.data[i] = 255; maskData.data[i+1] = 255; maskData.data[i+2] = 255; maskData.data[i+3] = 255;
        } else {
            // Background
            fgData.data[i] = 0; fgData.data[i+1] = 0; fgData.data[i+2] = 0; fgData.data[i+3] = 0;
            
            bgData.data[i] = imgData.data[i];
            bgData.data[i+1] = imgData.data[i+1];
            bgData.data[i+2] = imgData.data[i+2];
            bgData.data[i+3] = 255;
            
            // Mask
            maskData.data[i] = 0; maskData.data[i+1] = 0; maskData.data[i+2] = 0; maskData.data[i+3] = 255;
        }
    }
    
    fgCtx.putImageData(fgData, 0, 0);
    bgCtx.putImageData(bgData, 0, 0);
    maskCtx.putImageData(maskData, 0, 0);
    
    return { fgCanvas: fgCvs, bgCanvas: bgCvs, maskCanvas: maskCvs };
}

// Simple "Push-Pull" / Dilate Inpainting
function inpaintBackground(bgCanvas, maskCanvas) {
    const w = bgCanvas.width;
    const h = bgCanvas.height;
    const ctx = bgCanvas.getContext('2d');
    
    // We can simulate inpainting by repeatedly drawing the background image
    // with a slight blur + slight scaling behind itself to fill gaps.
    // Or a multi-pass smear.
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = w; outputCanvas.height = h;
    const outCtx = outputCanvas.getContext('2d');
    
    // 1. Draw original background
    outCtx.drawImage(bgCanvas, 0, 0);
    
    // 2. Fill holes using "Pyramid Filling" strategy (Iterative Blur)
    // Draw the image onto itself with offsets to fill gaps
    outCtx.globalCompositeOperation = 'destination-over'; // Draw BEHIND existing pixels
    
    // Pass 1: Small blur to fill small gaps
    outCtx.filter = 'blur(5px)';
    outCtx.drawImage(bgCanvas, 0, 0);
    
    // Pass 2: Medium blur
    outCtx.filter = 'blur(20px)';
    outCtx.drawImage(bgCanvas, 0, 0);
    
    // Pass 3: Large blur (for big holes)
    // We scale it up slightly to push pixels inward
    outCtx.filter = 'blur(50px)';
    outCtx.drawImage(bgCanvas, -w*0.05, -h*0.05, w*1.1, h*1.1);
    
    outCtx.filter = 'none';
    outCtx.globalCompositeOperation = 'source-over';
    
    return outputCanvas;
}

function buildScene(img, depthCanvas, fgCanvas, bgCanvas) {
    const aspect = img.width / img.height;
    const planeW = 2 * aspect;
    const planeH = 2;
    
    const loader = new THREE.TextureLoader();
    
    // --- Background Layer ---
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    const bgMat = new THREE.MeshBasicMaterial({ map: bgTex });
    // Place BG slightly further back
    const bgGeo = new THREE.PlaneGeometry(planeW * 1.2, planeH * 1.2); // Make it larger to cover edges
    bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.z = -0.5; // Push back
    scene.add(bgMesh);
    
    // --- Foreground Layer ---
    const fgTex = new THREE.CanvasTexture(fgCanvas);
    const fgDepthTex = new THREE.CanvasTexture(depthCanvas);
    
    // We displace the foreground to give it volume
    const fgGeo = new THREE.PlaneGeometry(planeW, planeH, 200, 200);
    const fgMat = new THREE.MeshStandardMaterial({
        map: fgTex,
        displacementMap: fgDepthTex,
        displacementScale: 0.4,
        displacementBias: -0.1, // Center
        transparent: true, // Needed for cutout
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide
    });
    
    fgMesh = new THREE.Mesh(fgGeo, fgMat);
    fgMesh.position.z = 0; // Center
    scene.add(fgMesh);
}

// 4. Interaction
function setupInteraction() {
    // Mouse Support
    document.addEventListener('mousemove', (e) => {
        // Desktop mouse support should always be active unless isMobile is explicitly true from Gyro
        if (isMobile) return;
        
        // Normalize -1 to 1
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        targetRotation.x = y * 0.5;
        targetRotation.y = x * 0.5;
    });

    // Touch Support (Drag to rotate)
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const x = (touch.clientX / window.innerWidth) * 2 - 1;
            const y = -(touch.clientY / window.innerHeight) * 2 + 1;
            targetRotation.x = y * 0.5;
            targetRotation.y = x * 0.5;
        }
    });
    
    // Gyro
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
            isMobile = true;
            const y = Math.max(-45, Math.min(45, e.beta || 0)) / 45;
            const x = Math.max(-45, Math.min(45, e.gamma || 0)) / 45;
            targetRotation.x = y * 0.5;
            targetRotation.y = x * 0.5;
        });
        
        // Permission
        const btn = document.getElementById('permission-btn');
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            btn.style.display = 'inline-block';
            btn.onclick = () => DeviceOrientationEvent.requestPermission()
                .then(r => r==='granted' && (btn.style.display='none', isMobile=true));
        }
    }
    
    // Upload
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', (e) => {
        if(e.target.files[0]) {
            const r = new FileReader();
            r.onload = (ev) => {
                const i = new Image();
                i.onload = () => processImage(i);
                i.src = ev.target.result;
            }
            r.readAsDataURL(e.target.files[0]);
        }
    });
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;
    
    // Move Camera instead of mesh for better "window" effect
    camera.position.x = currentRotation.y * 1.5; // Translate camera
    camera.position.y = currentRotation.x * 1.5;
    camera.lookAt(0, 0, 0); // Always look at center
    
    renderer.render(scene, camera);
}

function loadDefaultImage() {
    createPlaceholder();
}

function createPlaceholder() {
    const cvs = document.createElement('canvas'); cvs.width=512; cvs.height=512;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = "#2c3e50"; ctx.fillRect(0,0,512,512);
    ctx.fillStyle = "#fff"; ctx.font="30px sans-serif"; ctx.textAlign="center";
    ctx.fillText("请上传肖像图片", 256, 256);
    const i = new Image(); i.onload=()=>processImage(i); i.src=cvs.toDataURL();
}

init();
