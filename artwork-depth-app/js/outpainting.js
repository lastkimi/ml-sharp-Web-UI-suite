import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.0/dist/transformers.min.js';

// Configuration
const MODEL_ID = 'Xenova/depth-anything-small-hf';
env.allowLocalModels = false;

// Globals
let depthEstimator = null;
let scene, camera, renderer, mesh;
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
        statusText.textContent = "下载深度模型 (30MB)...";
        depthEstimator = await pipeline('depth-estimation', MODEL_ID, {
            progress_callback: (progress) => {
                if (progress.status === 'progress') {
                    const p = Math.round(progress.progress || 0);
                    progressFill.style.width = `${p}%`;
                }
            }
        });
        
        statusText.textContent = "准备就绪";
        loadDefaultImage();
    } catch (err) {
        console.error(err);
        alert("模型加载失败");
    }
}

// 2. Three.js Setup (Cylinder/Sphere Viewer)
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    
    // Wider FOV for immersive feel
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1); 
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Alpha true for debug
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Ambient light - Boost intensity
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);
    
    animate();
}

// 3. Core Processing
async function processImage(originalImg) {
    
    loadingOverlay.classList.remove('hidden');
    progressFill.style.width = "10%";
    
    // Cleanup
    if(mesh) scene.remove(mesh);
    
    // A. Resize to limit max dimension (e.g., 512px) 
    // Outpainting expands this to 1024, keeping GPU load manageable
    const img = resizeImage(originalImg, 512); 
    
    statusText.textContent = "1/3 智能扩图 (Outpainting)...";
    progressFill.style.width = "30%";
    
    // B. Smart Padding (Simulation of Generative Outpainting)
    // Expands image by 50% on all sides
    
    // Force a small delay to allow UI to update
    await new Promise(r => setTimeout(r, 100));

    const expandedCanvas = smartPadImage(img, 1.5); 
    
    statusText.textContent = "2/3 全局深度生成...";
    progressFill.style.width = "60%";
    
    // C. Depth on Expanded Image
    // Use the expanded canvas as input source URL
    try {
        const depthOutput = await depthEstimator(expandedCanvas.toDataURL());
        // .toCanvas() returns a canvas that matches the input size/aspect ratio roughly
        const depthCanvas = depthOutput.depth.toCanvas();
        
        
        // DEBUG: Ensure sizes match
        console.log(`Texture Size: ${expandedCanvas.width}x${expandedCanvas.height}`);
        console.log(`Depth Size: ${depthCanvas.width}x${depthCanvas.height}`);
        
        // Resize depth canvas to match texture canvas exactly if mismatch
        // (Transformers.js sometimes resizes output)
        const finalDepthCanvas = document.createElement('canvas');
        finalDepthCanvas.width = expandedCanvas.width;
        finalDepthCanvas.height = expandedCanvas.height;
        finalDepthCanvas.getContext('2d').drawImage(depthCanvas, 0, 0, expandedCanvas.width, expandedCanvas.height);

        statusText.textContent = "3/3 构建全景空间...";
        progressFill.style.width = "90%";
        
        // D. Build Immersive Mesh
        buildImmersiveScene(expandedCanvas, finalDepthCanvas);
    } catch (e) {
        console.error(e);
        alert(e);
    }
    
    loadingOverlay.classList.add('hidden');
}

function resizeImage(img, maxDim) {
    let w = img.width, h = img.height;
    if (w <= maxDim && h <= maxDim) return img;
    let scale = Math.min(maxDim / w, maxDim / h);
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const i = new Image(); i.src = c.toDataURL(); i.width=c.width; i.height=c.height;
    return i;
}

// "Smart Padding" - Simulates Outpainting using Mirror + Blur
function smartPadImage(img, expansionFactor) {
    const w = img.width;
    const h = img.height;
    const newW = Math.round(w * expansionFactor);
    const newH = Math.round(h * expansionFactor);
    const offsetX = (newW - w) / 2;
    const offsetY = (newH - h) / 2;
    
    const cvs = document.createElement('canvas');
    cvs.width = newW; cvs.height = newH;
    const ctx = cvs.getContext('2d');
    
    // Fill background with black
    ctx.fillStyle = "black";
    ctx.fillRect(0,0,newW,newH);
    
    // 1. Draw blurred/mirrored edges to simulate "content"
    ctx.save();
    ctx.filter = "blur(20px) brightness(0.6)"; // Dark & Blurry periphery
    // We draw the image scaled up to cover the background
    ctx.drawImage(img, 0, 0, newW, newH);
    ctx.restore();
    
    // 2. Draw original image in center (Clear)
    ctx.drawImage(img, offsetX, offsetY, w, h);
    
    // 3. Blend edges (Vignette mask) to smooth transition
    // Create a gradient mask
    // We want sharp center, faded edges
    // Actually, we can just overlay a "frame" that blurs the seam
    
    return cvs;
}

function buildImmersiveScene(textureCanvas, depthCanvas) {

    const tex = new THREE.CanvasTexture(textureCanvas);
    const depthTex = new THREE.CanvasTexture(depthCanvas);
    
    // Fix Texture Mapping
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    
    // Geometry: A curved Cylinder section or Sphere
    // We want it to surround the user.
    // Radius = 5, Height = based on aspect ratio
    const aspect = textureCanvas.width / textureCanvas.height;
    
    // Use PlaneGeometry for testing if Sphere is causing UV issues, 
    // OR fix Sphere UVs.
    // Let's use a simpler "Bent Plane" (CylinderGeometry) which is safer for UVs than Sphere
    // Cylinder: radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength
    const radius = 4;
    const height = radius * 2 / aspect; // Maintain aspect ratio roughly
    const arc = Math.PI * 0.8; // 144 degrees view
    
    const geometry = new THREE.CylinderGeometry(
        radius, radius, 
        height, 
        64, 64, 
        true, // openEnded
        Math.PI * 1.5 - arc/2, // Center the arc at 270 deg (3PI/2) which is -Z in XZ plane
        arc
    );
    
    // Invert geometry so we see inside
    geometry.scale(-1, 1, 1);
    
    const material = new THREE.MeshStandardMaterial({
        map: tex,
        displacementMap: depthTex,
        displacementScale: 1.5, // Strong depth
        displacementBias: -0.5,
        side: THREE.DoubleSide, // Ensure visibility from all angles
        roughness: 0.8
    });
    
    mesh = new THREE.Mesh(geometry, material);
    // Remove rotation, verify orientation
    // mesh.rotation.y = Math.PI; 
    scene.add(mesh);
    
    // Add a simple PointLight to ensure StandardMaterial is lit
    // (Ambient might be too dim or flat)
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(0, 0, 0); // Light from center (viewer)
    scene.add(light);
    
    // Reset camera look
    targetRotation = { x: 0, y: 0 };
    currentRotation = { x: 0, y: 0 };
    
    // Fix orientation: Rotate mesh so image center is at -Z (Camera looks down -Z)
    // Cylinder is created along Y axis. Texture wraps around.
    // We need to rotate Y to align the "center" of our partial arc with -Z.
    // Try rotating PI (180 deg) to flip it around.
    mesh.rotation.y = Math.PI; 
    
    // Also, let's adjust camera Z slightly to ensure we aren't clipping
    camera.position.set(0, 0, 0.1);
    
    // 激活 UI 控制（图片加载后自动隐藏按钮）
    if (window.uiController) {
        window.uiController.activate();
    }
}

// 4. Interaction
function setupInteraction() {
    document.addEventListener('mousemove', (e) => {
        if (isMobile) return;
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        targetRotation.x = y * 0.8; // Allow looking further
        targetRotation.y = x * 0.8;
    });

    // Touch
    document.addEventListener('touchmove', (e) => {
        if(e.touches.length > 0) {
            const t = e.touches[0];
            const x = (t.clientX / window.innerWidth) * 2 - 1;
            const y = -(t.clientY / window.innerHeight) * 2 + 1;
            targetRotation.x = y * 0.8;
            targetRotation.y = x * 0.8;
        }
    });
    
    // Gyro
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
            isMobile = true;
            const y = Math.max(-45, Math.min(45, e.beta || 0)) / 45;
            const x = Math.max(-45, Math.min(45, e.gamma || 0)) / 45;
            targetRotation.x = y;
            targetRotation.y = x;
        });
        
        const btn = document.getElementById('permission-btn');
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            btn.style.display = 'inline-block';
            btn.onclick = () => DeviceOrientationEvent.requestPermission()
                .then(r => r==='granted' && (btn.style.display='none', isMobile=true));
        }
    }
    
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
    
    // Rotate Camera to look around inside the sphere
    camera.rotation.x = currentRotation.x;
    camera.rotation.y = -currentRotation.y;
    
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
    ctx.fillText("请上传图片", 256, 256);
    const i = new Image(); i.onload=()=>processImage(i); i.src=cvs.toDataURL();
}

init();