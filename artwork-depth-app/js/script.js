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
            
            // 设置 canvas 为全屏尺寸
            resizeCanvas();
            
            // 绘制原图（铺满 canvas，保持宽高比）
            drawImageToFillCanvas();
            uploadPrompt.style.display = 'none';
            
            // 开始分割
            await performSegmentation();
            
            // 启用控件
            effectControls.classList.remove('disabled');
            
            // 激活 UI 控制（图片加载后自动隐藏按钮）
            activateUIControl();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 调整 canvas 为全屏尺寸
function resizeCanvas() {
    // 获取屏幕尺寸
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 设置 canvas 的实际像素尺寸（使用设备像素比以获得清晰度）
    const dpr = window.devicePixelRatio || 1;
    canvas.width = screenWidth * dpr;
    canvas.height = screenHeight * dpr;
    
    // 设置 canvas 的显示尺寸（CSS 控制）
    canvas.style.width = screenWidth + 'px';
    canvas.style.height = screenHeight + 'px';
    
    // 缩放上下文以匹配设备像素比（这样绘制时可以使用屏幕坐标）
    ctx.scale(dpr, dpr);
}

// 绘制图片铺满 canvas（保持宽高比，图片完全填充 canvas）
function drawImageToFillCanvas() {
    if (!currentImage) return;
    
    const canvasDisplayWidth = window.innerWidth;
    const canvasDisplayHeight = window.innerHeight;
    
    const imgAspect = originalWidth / originalHeight;
    const canvasAspect = canvasDisplayWidth / canvasDisplayHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    // 使用 cover 模式：图片完全填充 canvas，可能会裁剪
    if (imgAspect > canvasAspect) {
        // 图片更宽，以高度为准（图片会超出宽度）
        drawHeight = canvasDisplayHeight;
        drawWidth = canvasDisplayHeight * imgAspect;
        offsetX = (canvasDisplayWidth - drawWidth) / 2;
        offsetY = 0;
    } else {
        // 图片更高，以宽度为准（图片会超出高度）
        drawWidth = canvasDisplayWidth;
        drawHeight = canvasDisplayWidth / imgAspect;
        offsetX = 0;
        offsetY = (canvasDisplayHeight - drawHeight) / 2;
    }
    
    // 清除画布
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);
    
    // 绘制图片（铺满整个 canvas）
    ctx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);
}

// 窗口大小变化时重新调整
window.addEventListener('resize', function() {
    if (currentImage) {
        resizeCanvas();
        if (currentMask) {
            updateRender();
        } else {
            drawImageToFillCanvas();
        }
    }
});

// 激活 UI 控制
function activateUIControl() {
    const controlsPanel = document.getElementById('controls-panel');
    const pageHeader = document.getElementById('page-header');
    let isVisible = true;
    let autoHideTimer = null;
    
    // 点击屏幕切换显示/隐藏
    document.addEventListener('click', function(e) {
        // 如果点击的是控制面板本身，不切换
        if (e.target.closest('#controls-panel')) {
            return;
        }
        
        if (isVisible) {
            controlsPanel.classList.add('hidden');
            if (pageHeader) pageHeader.classList.add('hidden');
            isVisible = false;
        } else {
            controlsPanel.classList.remove('hidden');
            if (pageHeader) pageHeader.classList.remove('hidden');
            isVisible = true;
            // 显示后 3 秒自动隐藏
            scheduleAutoHide();
        }
    });
    
    // 触摸事件（移动端）
    document.addEventListener('touchend', function(e) {
        if (e.target.closest('#controls-panel')) {
            return;
        }
        
        if (isVisible) {
            controlsPanel.classList.add('hidden');
            if (pageHeader) pageHeader.classList.add('hidden');
            isVisible = false;
        } else {
            controlsPanel.classList.remove('hidden');
            if (pageHeader) pageHeader.classList.remove('hidden');
            isVisible = true;
            scheduleAutoHide();
        }
    });
    
    // 安排自动隐藏
    function scheduleAutoHide() {
        if (autoHideTimer) clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => {
            if (isVisible) {
                controlsPanel.classList.add('hidden');
                if (pageHeader) pageHeader.classList.add('hidden');
                isVisible = false;
            }
        }, 3000);
    }
    
    // 初始延迟隐藏
    scheduleAutoHide();
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

        // 执行分割（在原始图片上进行，而不是 canvas）
        const segmentation = await net.segmentPerson(currentImage, {
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
    // 使用显示尺寸
    const w = window.innerWidth;
    const h = window.innerHeight;
    
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

    // 使用显示尺寸（而不是 canvas 的实际像素尺寸）
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1. 清空
    ctx.clearRect(0, 0, w, h);

    // 2. 准备 Mask Canvas（使用显示尺寸）
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
        // 将 maskData 缩放到显示尺寸
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskData.width;
        tempCanvas.height = maskData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(maskData, 0, 0);
        // 缩放绘制到 maskCanvas
        maskCtx.drawImage(tempCanvas, 0, 0, w, h);
    }
    
    if (showMask) {
        // 调试模式
        ctx.fillStyle = 'black';
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(maskCanvas, 0, 0);
        return;
    }

    if (blurRadius === 0) {
        drawImageToFillCanvas();
        return;
    }

    // --- 合成逻辑 ---
    // 计算图片铺满 canvas 的尺寸和位置
    const imgAspect = originalWidth / originalHeight;
    const canvasAspect = w / h;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspect > canvasAspect) {
        // 图片更宽，以宽度为准
        drawWidth = w;
        drawHeight = w / imgAspect;
        offsetX = 0;
        offsetY = (h - drawHeight) / 2;
    } else {
        // 图片更高，以高度为准
        drawHeight = h;
        drawWidth = h * imgAspect;
        offsetX = (w - drawWidth) / 2;
        offsetY = 0;
    }

    // 1. 绘制模糊背景层（铺满 canvas）
    ctx.save();
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();

    // 2. 绘制清晰主体层
    // 逻辑：清晰层 = 原图 masked by Mask
    const cleanCanvas = document.createElement('canvas');
    cleanCanvas.width = w;
    cleanCanvas.height = h;
    const cleanCtx = cleanCanvas.getContext('2d');
    
    cleanCtx.drawImage(currentImage, offsetX, offsetY, drawWidth, drawHeight);
    
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
