// 全局变量
let net = null;
let currentImage = null; // HTMLImageElement
let currentMask = null; // ImageData or Tensor
let useFallback = false; // 是否使用降级模式（无AI）
let originalWidth = 0;
let originalHeight = 0;
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const uploadPrompt = document.getElementById('uploadPrompt');
const effectControls = document.getElementById('effectControls');

// UI 控件
const blurSlider = document.getElementById('blurSlider');
const blurValueDisplay = document.getElementById('blurValue');
const thresholdSlider = document.getElementById('maskThreshold');
const thresholdValueDisplay = document.getElementById('thresholdValue');
const showMaskToggle = document.getElementById('showMaskToggle');

// 初始化：加载 BodyPix 模型
async function init() {
    try {
        loading.classList.remove('hidden');
        loadingText.textContent = "正在加载 AI 模型 (TensorFlow.js)...";
        
        // 加载 MobileNetV1 架构的模型，适合移动端和浏览器，速度快
        // 尝试加载，如果网络不通则切换到手动模式
        net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        
        loading.classList.add('hidden');
        console.log("BodyPix model loaded.");
    } catch (error) {
        console.error("Error loading model:", error);
        loading.classList.add('hidden');
        useFallback = true;
        alert("模型加载失败（可能是网络原因）。已切换到「手动对焦模式」，您仍可体验景深效果。");
        // 更新UI状态
        thresholdSlider.parentElement.style.opacity = '0.5';
        thresholdSlider.disabled = true;
    }
}

// 事件监听
document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
blurSlider.addEventListener('input', updateRender);
thresholdSlider.addEventListener('change', reSegmentImage); // 阈值改变需要重新分割
showMaskToggle.addEventListener('change', updateRender);

// 处理图片上传
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = async function() {
            currentImage = img;
            originalWidth = img.width;
            originalHeight = img.height;
            
            // 调整 canvas 尺寸以适应图片（这里做简单的限制，防止过大卡顿）
            const maxDim = 800;
            let scale = 1;
            if (Math.max(originalWidth, originalHeight) > maxDim) {
                scale = maxDim / Math.max(originalWidth, originalHeight);
            }
            
            canvas.width = originalWidth * scale;
            canvas.height = originalHeight * scale;
            
            // 绘制原图
            ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
            uploadPrompt.style.display = 'none';
            
            // 开始分割
            await performSegmentation();
            
            // 启用控件
            effectControls.classList.remove('disabled');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 执行分割 (核心逻辑)
async function performSegmentation() {
    if (!currentImage) return;

    // 如果使用了降级模式，生成一个简单的径向蒙版
    if (useFallback) {
        createFallbackMask();
        updateRender();
        return;
    }

    if (!net) return;

    loading.classList.remove('hidden');
    loadingText.textContent = "正在识别图像主体...";

    try {
        const threshold = parseFloat(thresholdSlider.value);
        thresholdValueDisplay.textContent = threshold;

        // 执行分割
        const segmentation = await net.segmentPerson(canvas, {
            flipHorizontal: false,
            internalResolution: 'medium',
            segmentationThreshold: threshold
        });

        currentMask = segmentation;
        
        // 初始渲染
        updateRender();
        
    } catch (error) {
        console.error("Segmentation failed:", error);
        useFallback = true;
        createFallbackMask();
        updateRender();
    } finally {
        loading.classList.add('hidden');
    }
}

// 创建降级模式的蒙版（中心清晰，四周模糊）
function createFallbackMask() {
    const w = canvas.width;
    const h = canvas.height;
    
    // 我们用 Canvas 绘制一个径向渐变作为 Mask
    // 中心白色(清晰)，边缘黑色(模糊)
    // BodyPix 的 Mask 格式比较特殊，为了兼容 updateRender 逻辑，我们需要模拟一个 maskData
    // 或者我们直接修改 updateRender 来支持 Canvas 类型的 Mask
    
    // 这里我们简单起见，修改 updateRender 逻辑更灵活
    // 标记当前模式
    currentMask = "fallback"; 
}

async function reSegmentImage() {
    await performSegmentation();
}

// 渲染合成效果
function updateRender() {
    if (!currentImage || !currentMask) return;

    const blurRadius = parseInt(blurSlider.value);
    blurValueDisplay.textContent = blurRadius;
    const showMask = showMaskToggle.checked;

    const w = canvas.width;
    const h = canvas.height;

    // 1. 清空
    ctx.clearRect(0, 0, w, h);

    // 2. 准备 Mask Canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');

    if (currentMask === "fallback") {
        // 绘制径向渐变
        const gradient = maskCtx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.2, w/2, h/2, Math.min(w,h)*0.6);
        gradient.addColorStop(0, 'rgba(0,0,0,255)'); // 中心不透明（代表保留清晰主体）
        gradient.addColorStop(1, 'rgba(0,0,0,0)');   // 边缘透明
        maskCtx.fillStyle = gradient;
        maskCtx.fillRect(0, 0, w, h);
    } else {
        // AI 模式：BodyPix Mask
        // BodyPix 的 toMask 生成的是 ImageData
        // 我们需要：主体部分不透明(Alpha=255)，背景透明(Alpha=0)
        const maskData = bodyPix.toMask(currentMask, {r:0,g:0,b:0,a:255}, {r:0,g:0,b:0,a:0});
        maskCtx.putImageData(maskData, 0, 0);
    }
    
    if (showMask) {
        // 调试模式
        ctx.fillStyle = 'black';
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(maskCanvas, 0, 0);
        return;
    }

    if (blurRadius === 0) {
        ctx.drawImage(currentImage, 0, 0, w, h);
        return;
    }

    // --- 合成逻辑 ---
    // 1. 绘制模糊背景层
    ctx.save();
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(currentImage, 0, 0, w, h);
    ctx.restore();

    // 2. 绘制清晰主体层
    // 逻辑：清晰层 = 原图 masked by Mask
    const cleanCanvas = document.createElement('canvas');
    cleanCanvas.width = w;
    cleanCanvas.height = h;
    const cleanCtx = cleanCanvas.getContext('2d');
    
    cleanCtx.drawImage(currentImage, 0, 0, w, h);
    
    // 应用遮罩：destination-in 会保留与新图形重叠且不透明的部分
    // 注意：MaskCanvas 中不透明的部分是我们要保留清晰的
    cleanCtx.globalCompositeOperation = 'destination-in';
    cleanCtx.drawImage(maskCanvas, 0, 0);
    
    // 3. 将清晰层叠在模糊层上
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(cleanCanvas, 0, 0);
}

// 启动
init();
