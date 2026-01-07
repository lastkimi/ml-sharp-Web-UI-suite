// 全局变量
let scene, camera, renderer;
let material, mesh;
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let isMobile = false;

// 视差强度参数
const PARALLAX_INTENSITY = 0.05; // 深度位移强度

// 初始化 Three.js 场景
function init() {
    const container = document.getElementById('canvas-container');

    // 1. Scene
    scene = new THREE.Scene();

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 2; // 相机距离

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 4. 加载默认图片和深度图
    // 为了方便演示，这里我们先只加载一张默认图，深度图由 createFakeDepthMap 生成
    // 实际项目中，应该加载用户上传的图片
    loadDefaultImage('data/teaser.jpg'); // 假设 teaser.jpg 存在于 data 目录，但这里我们在 artwork-depth-app 目录下，可能访问不到上层。
    // 我们先用一个占位符或者让用户上传
    
    // 事件监听
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);
    
    // 移动端陀螺仪支持
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', onDeviceOrientation, false);
        isMobile = true;
        // iOS 13+ 需要权限请求
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const btn = document.getElementById('permission-btn');
            btn.style.display = 'inline-block';
            btn.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            btn.style.display = 'none';
                        } else {
                            alert('需要陀螺仪权限才能体验 3D 效果');
                        }
                    })
                    .catch(console.error);
            });
        }
    }

    // 图片上传处理
    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', handleImageUpload);
    
    animate();
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // 生成贴图
            const texture = new THREE.Texture(img);
            texture.needsUpdate = true;
            
            // 生成伪深度图 (因为是前端纯演示，没有后端 AI 生成深度图)
            // 真实场景下，应该在这里请求后端 API 获取 depth map
            const depthCanvas = createFakeDepthMap(img);
            const depthTexture = new THREE.CanvasTexture(depthCanvas);
            
            updateScene(texture, depthTexture, img.width / img.height);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 创建一个伪深度图 (简单的径向/线性渐变，模拟中间近、四周远)
function createFakeDepthMap(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    // 简单的径向渐变：中心白(近)，四周黑(远)
    // 这对于人像或静物通常效果还行
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 1.5
    );
    gradient.addColorStop(0, '#ffffff'); // 近
    gradient.addColorStop(1, '#000000'); // 远
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return canvas;
}

function updateScene(texture, depthTexture, aspectRatio) {
    // 移除旧 mesh
    if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }

    // 顶点着色器
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // 片元着色器 (核心视差逻辑)
    const fragmentShader = `
        uniform sampler2D map;      // 原图
        uniform sampler2D depthMap; // 深度图
        uniform vec2 mouse;         // 鼠标/陀螺仪偏移量
        uniform float intensity;    // 强度
        varying vec2 vUv;

        void main() {
            // 读取深度值 (0.0 - 1.0)
            float depth = texture2D(depthMap, vUv).r;
            
            // 计算偏移: 深度越大(越白/越近)，偏移越明显
            // 也可以反过来：深度越小(越黑/越远)，移动越慢 -> 产生视差
            // 这里我们让“近处”移动多一点，或者背景移动多一点，取决于想要的效果
            // 通常：背景不动，前景随视角移动(反向)
            
            vec2 offset = mouse * intensity * depth;
            
            // 读取偏移后的纹理坐标
            // 简单的偏移映射
            vec4 color = texture2D(map, vUv - offset);
            
            gl_FragColor = color;
        }
    `;

    const geometry = new THREE.PlaneGeometry(2 * aspectRatio, 2);
    material = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: texture },
            depthMap: { value: depthTexture },
            mouse: { value: new THREE.Vector2(0, 0) },
            intensity: { value: PARALLAX_INTENSITY }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
}

function onDocumentMouseMove(event) {
    // 归一化鼠标坐标 (-1 到 1)
    targetMouse.x = (event.clientX - windowHalfX) / windowHalfX;
    targetMouse.y = (event.clientY - windowHalfY) / windowHalfY;
}

function onDeviceOrientation(event) {
    // 简单的映射：beta (x轴翻转), gamma (y轴翻转)
    // 限制范围防止过度旋转
    let x = event.gamma / 45; // -1 to 1
    let y = event.beta / 45;  // -1 to 1
    
    // 简单的 clamp
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    
    targetMouse.x = x;
    targetMouse.y = y;
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    // 平滑插值
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    if (material && material.uniforms) {
        material.uniforms.mouse.value.x = mouse.x;
        material.uniforms.mouse.value.y = -mouse.y; // Y轴反转
    }

    renderer.render(scene, camera);
}

// 占位图加载器
function loadDefaultImage(url) {
    const loader = new THREE.TextureLoader();
    // 由于可能是跨域或本地文件问题，我们先尝试创建一个简单的 Canvas 纹理作为“默认图”
    // 这样用户打开就能看到东西，而不是黑屏
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0,0,512,512);
    ctx.fillStyle = '#e67e22';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("请上传图片", 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    const depthCanvas = createFakeDepthMap(canvas); // 对应的深度图
    const depthTexture = new THREE.CanvasTexture(depthCanvas);
    
    updateScene(texture, depthTexture, 1.0);
}

// 启动
init();
