import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.0/dist/transformers.min.js';

// Configuration
// We use a quantized version of Depth Anything Small to keep it browser-friendly
const MODEL_ID = 'Xenova/depth-anything-small-hf';
env.allowLocalModels = false; // Force CDN

// Globals
let depthEstimator = null;
let scene, camera, renderer, mesh;
let currentTexture = null;
let currentDepthTexture = null;
let originalImage = null; // HTMLImageElement
let targetRotation = { x: 0, y: 0 };
let currentRotation = { x: 0, y: 0 };
let isMobile = false;

// UI Elements
const statusText = document.getElementById('status-text');
const progressFill = document.getElementById('progress-fill');
const loadingOverlay = document.getElementById('loading-overlay');
const debugInfo = document.getElementById('debug-info');

// 1. Initialization
async function init() {
    initThreeJS();
    setupInteraction();
    
    // Load Model
    try {
        statusText.textContent = "正在下载深度估计模型...";
        depthEstimator = await pipeline('depth-estimation', MODEL_ID, {
            progress_callback: (progress) => {
                if (progress.status === 'progress') {
                    const p = Math.round(progress.progress || 0);
                    progressFill.style.width = `${p}%`;
                    statusText.textContent = `加载模型中... ${p}%`;
                }
            }
        });
        statusText.textContent = "模型准备就绪！";
        
        // Load default image (placeholder)
        loadDefaultImage();
    } catch (err) {
        console.error(err);
        statusText.textContent = "模型加载失败: " + err.message;
        alert("WebGPU/WASM 模型加载失败，请尝试使用 Chrome 桌面版或更新的浏览器。");
    }
}

// 2. Three.js Setup
function initThreeJS() {
    // #region agent log
    const logData = {
        location: 'immersive.js:53',
        message: 'initThreeJS entry',
        data: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            bodyWidth: document.body.clientWidth,
            bodyHeight: document.body.clientHeight
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'A'
    };
    fetch('http://127.0.0.1:7247/ingest/93841103-6491-4b0e-9a7c-e6904db70b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(()=>{});
    // #endregion
    
    const container = document.getElementById('canvas-container');
    
    // #region agent log
    if (container) {
        const containerStyle = window.getComputedStyle(container);
        const logData2 = {
            location: 'immersive.js:62',
            message: 'container found',
            data: {
                containerExists: true,
                containerId: container.id,
                containerWidth: containerStyle.width,
                containerHeight: containerStyle.height,
                containerPosition: containerStyle.position,
                containerTop: containerStyle.top,
                containerLeft: containerStyle.left,
                containerDisplay: containerStyle.display,
                containerOffsetWidth: container.offsetWidth,
                containerOffsetHeight: container.offsetHeight
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run2',
            hypothesisId: 'B'
        };
        fetch('http://127.0.0.1:7247/ingest/93841103-6491-4b0e-9a7c-e6904db70b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(()=>{});
    }
    // #endregion
    
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2.5; // Slightly further back to see whole mesh
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const canvasEl = renderer.domElement;
    
    // #region agent log
    const canvasStyleBefore = window.getComputedStyle(canvasEl);
    const logData3 = {
        location: 'immersive.js:85',
        message: 'renderer created, before append',
        data: {
            canvasWidth: canvasEl.width,
            canvasHeight: canvasEl.height,
            canvasStyleWidth: canvasEl.style.width,
            canvasStyleHeight: canvasEl.style.height,
            computedWidth: canvasStyleBefore.width,
            computedHeight: canvasStyleBefore.height,
            computedPosition: canvasStyleBefore.position,
            computedDisplay: canvasStyleBefore.display
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'E'
    };
    fetch('http://127.0.0.1:7247/ingest/93841103-6491-4b0e-9a7c-e6904db70b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(()=>{});
    // #endregion
    
    // 确保容器本身是全屏的
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.zIndex = '1';
    
    container.appendChild(renderer.domElement);
    
    // 强制设置 canvas 元素为全屏样式
    canvasEl.style.position = 'absolute';
    canvasEl.style.top = '0';
    canvasEl.style.left = '0';
    canvasEl.style.right = '0';
    canvasEl.style.bottom = '0';
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    canvasEl.style.margin = '0';
    canvasEl.style.padding = '0';
    canvasEl.style.boxSizing = 'border-box';
    
    // 确保 body 和 html 也是全屏
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';
    
    // #region agent log
    setTimeout(() => {
        const canvasStyleAfter = window.getComputedStyle(canvasEl);
        const containerStyleAfter = window.getComputedStyle(container);
        const logData4 = {
            location: 'immersive.js:105',
            message: 'after setting canvas styles (delayed)',
            data: {
                canvasWidth: canvasEl.width,
                canvasHeight: canvasEl.height,
                canvasStyleWidth: canvasEl.style.width,
                canvasStyleHeight: canvasEl.style.height,
                computedWidth: canvasStyleAfter.width,
                computedHeight: canvasStyleAfter.height,
                computedPosition: canvasStyleAfter.position,
                computedTop: canvasStyleAfter.top,
                computedLeft: canvasStyleAfter.left,
                containerComputedWidth: containerStyleAfter.width,
                containerComputedHeight: containerStyleAfter.height,
                containerComputedPosition: containerStyleAfter.position,
                canvasOffsetWidth: canvasEl.offsetWidth,
                canvasOffsetHeight: canvasEl.offsetHeight
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run2',
            hypothesisId: 'C'
        };
        fetch('http://127.0.0.1:7247/ingest/93841103-6491-4b0e-9a7c-e6904db70b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(()=>{});
    }, 100);
    // #endregion
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    animate();
}

// 3. Image Processing & Depth Generation
async function processImage(imgElement) {
    loadingOverlay.classList.remove('hidden');
    statusText.textContent = "正在生成 3D 深度结构...";
    progressFill.style.width = "50%"; // Fake progress for inference
    
    try {
        // Run inference
        const output = await depthEstimator(imgElement.src);
        // Output is { depth: Tensor, predicted_depth: Tensor }
        // We need to convert the depth tensor to a texture
        
        const depthData = output.depth; // This is a raw object with data, width, height
        
        // Convert Raw Depth to Canvas/Texture
        // The output from transformers.js depth-estimation is an object with a .toCanvas() method usually,
        // or we access the raw tensor. 
        // Note: Check specific return type for this pipeline. 
        // Usually it returns { depth: Image, ... } where Image is a PIL-like object in Python, 
        // but in JS it returns a 'RawImage' object which has .toCanvas().
        
        const depthCanvas = output.depth.toCanvas();
        
        // Update Scene
        updateMesh(imgElement, depthCanvas);
        
        loadingOverlay.classList.add('hidden');
    } catch (err) {
        console.error("Inference Error:", err);
        statusText.textContent = "深度生成失败";
        loadingOverlay.classList.add('hidden');
    }
}

function updateMesh(img, depthCanvas) {
    if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
    
    // Create Textures
    const loader = new THREE.TextureLoader();
    const texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    
    const depthTexture = new THREE.CanvasTexture(depthCanvas);
    
    // Geometry: High segment plane for displacement
    // Segments depend on device power. 200x200 is decent for desktop, maybe 128x128 for mobile.
    const segments = isMobile ? 128 : 256; 
    const geometry = new THREE.PlaneGeometry(img.width / img.height * 2, 2, segments, segments);
    
    // Standard Material with Displacement
    // Using MeshStandardMaterial allows lighting interaction if we wanted, 
    // but MeshBasicMaterial is safer for pure color reproduction. 
    // However, DisplacementMap requires MeshStandard or MeshPhong or custom Shader.
    // Let's use MeshStandardMaterial to get the displacement feature out of the box.
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        displacementMap: depthTexture,
        displacementScale: 0.5, // How much it pops out
        displacementBias: -0.2, // Center the mesh
        side: THREE.DoubleSide, // See back if rotated too much
        roughness: 0.5,
        metalness: 0.0
    });
    
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    
    // 激活 UI 控制（图片加载后自动隐藏按钮）
    if (window.uiController) {
        window.uiController.activate();
    }
}

// 4. Interaction (Gyro + Mouse)
function setupInteraction() {
    // Mouse
    document.addEventListener('mousemove', (e) => {
        // Desktop mouse support should always be active unless isMobile is explicitly true from Gyro
        if (isMobile) return; 
        
        // Normalize -1 to 1
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        targetRotation.x = y * 0.5; // Max rotation angle
        targetRotation.y = x * 0.5;
    });

    // Handle touch move for "drag to rotate" on mobile if gyro is off
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
        window.addEventListener('deviceorientation', handleGyro, false);
        
        // Permission Button
        const btn = document.getElementById('permission-btn');
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            btn.style.display = 'inline-block';
            btn.onclick = () => {
                DeviceOrientationEvent.requestPermission()
                    .then(resp => {
                        if (resp === 'granted') {
                            btn.style.display = 'none';
                            isMobile = true;
                        }
                    })
                    .catch(console.error);
            };
        } else {
            // Android / Non-iOS
            isMobile = true;
        }
    }
    
    // Resize
    window.addEventListener('resize', () => {
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/93841103-6491-4b0e-9a7c-e6904db70b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'immersive.js:338',message:'resize event',data:{innerWidth:window.innerWidth,innerHeight:window.innerHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // 确保容器和 canvas 样式保持全屏
        const container = document.getElementById('canvas-container');
        if (container) {
            container.style.width = '100vw';
            container.style.height = '100vh';
        }
        const canvasEl = renderer.domElement;
        canvasEl.style.width = '100%';
        canvasEl.style.height = '100%';
        
        // 确保 body 和 html 也是全屏
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/93841103-6491-4b0e-9a7c-e6904db70b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'immersive.js:358',message:'after resize setSize',data:{canvasWidth:canvasEl.width,canvasHeight:canvasEl.height,canvasStyleWidth:canvasEl.style.width,canvasStyleHeight:canvasEl.style.height,computedWidth:window.getComputedStyle(canvasEl).width,computedHeight:window.getComputedStyle(canvasEl).height,containerWidth:container?.offsetWidth,containerHeight:container?.offsetHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
    });

    // Upload
    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => processImage(img);
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function handleGyro(e) {
    if (!isMobile) return;
    
    // Beta: -180 to 180 (front/back tilt)
    // Gamma: -90 to 90 (left/right tilt)
    
    // Simple clamp and map
    const maxTilt = 45; // degrees
    const y = Math.max(-maxTilt, Math.min(maxTilt, e.beta || 0)) / maxTilt;
    const x = Math.max(-maxTilt, Math.min(maxTilt, e.gamma || 0)) / maxTilt;
    
    // Note: Gyro axes might need inversion depending on orientation
    targetRotation.x = y * 0.5;
    targetRotation.y = x * 0.5;
    
    debugInfo.textContent = `Beta: ${e.beta?.toFixed(1)}, Gamma: ${e.gamma?.toFixed(1)}`;
}

// 5. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    // Smooth interpolation
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.1;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.1;
    
    if (mesh) {
        // Move the mesh or the camera?
        // Moving the mesh is often simpler for "object inspection"
        // But for "looking through a window" (parallax), we move the camera.
        // User asked for "AR like... look around", implies camera movement.
        
        // Let's rotate the mesh to simulate looking around it
        mesh.rotation.x = currentRotation.x;
        mesh.rotation.y = currentRotation.y;
        
        // Also subtle position parallax
        mesh.position.x = currentRotation.y * 0.5;
        mesh.position.y = -currentRotation.x * 0.5;
    }
    
    renderer.render(scene, camera);
}

// Helper: Load placeholder
function loadDefaultImage() {
    // Attempt to load the local teaser if served
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => processImage(img);
    img.onerror = () => {
        // Fallback if local image fails
        console.warn("Could not load default image, waiting for upload.");
        loadingOverlay.classList.add('hidden');
    };
    // Assuming python http.server is run from parent dir, data/teaser.jpg is accessible
    // But we are in artwork-depth-app/, so we might need ../data/teaser.jpg or similar.
    // Let's try a relative path assuming the user copied data/teaser.jpg to artwork-depth-app/
    // OR create a placeholder canvas.
    createPlaceholder();
}

function createPlaceholder() {
    const cvs = document.createElement('canvas');
    cvs.width = 512;
    cvs.height = 512;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(0,0,512,512);
    ctx.fillStyle = "#fff";
    ctx.font = "30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("请上传图片", 256, 256);
    
    const img = new Image();
    img.onload = () => processImage(img);
    img.src = cvs.toDataURL();
}

// Start
init();
