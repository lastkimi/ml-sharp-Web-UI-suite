/**
 * 移动端工具函数
 * 提供移动端检测、触摸优化等功能
 */

// 检测是否为移动设备
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));

// 检测是否为触摸设备
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// 添加移动端类到 body
if (isMobile) {
    document.documentElement.classList.add('mobile-device');
    document.body.classList.add('mobile-device');
}

if (isTouchDevice) {
    document.documentElement.classList.add('touch-device');
    document.body.classList.add('touch-device');
}

// 防止双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// 优化触摸滚动
if (isTouchDevice) {
    // 添加平滑滚动
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // 优化触摸延迟
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
    document.getElementsByTagName('head')[0].appendChild(meta);
}

// 防止 iOS Safari 的橡皮筋效果
document.addEventListener('touchmove', function(event) {
    if (event.target.closest('.no-bounce')) {
        event.preventDefault();
    }
}, { passive: false });

// 优化 Canvas 触摸事件
function setupCanvasTouch(canvas) {
    if (!isTouchDevice) return;
    
    let isDragging = false;
    let lastTouch = null;
    
    canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            isDragging = true;
            lastTouch = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
    }, { passive: true });
    
    canvas.addEventListener('touchmove', function(e) {
        if (isDragging && e.touches.length === 1 && lastTouch) {
            const deltaX = e.touches[0].clientX - lastTouch.x;
            const deltaY = e.touches[0].clientY - lastTouch.y;
            
            // 触发自定义事件
            const event = new CustomEvent('canvasTouchMove', {
                detail: { deltaX, deltaY, touch: e.touches[0] }
            });
            canvas.dispatchEvent(event);
            
            lastTouch = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
    }, { passive: true });
    
    canvas.addEventListener('touchend', function(e) {
        isDragging = false;
        lastTouch = null;
    }, { passive: true });
}

// 优化按钮点击反馈
function setupButtonFeedback() {
    const buttons = document.querySelectorAll('button, .btn, a.btn');
    buttons.forEach(btn => {
        btn.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
            this.style.opacity = '0.8';
        }, { passive: true });
        
        btn.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.transform = '';
                this.style.opacity = '';
            }, 150);
        }, { passive: true });
    });
}

// 检测设备方向变化
function setupOrientationChange(callback) {
    const orientationChangeEvent = window.orientation !== undefined ? 'orientationchange' : 'resize';
    
    window.addEventListener(orientationChangeEvent, function() {
        setTimeout(() => {
            if (callback) callback();
        }, 100);
    });
}

// 获取安全区域（iPhone X 等）
function getSafeAreaInsets() {
    const style = getComputedStyle(document.documentElement);
    return {
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
    };
}

// 导出工具函数
window.MobileUtils = {
    isMobile,
    isTouchDevice,
    setupCanvasTouch,
    setupButtonFeedback,
    setupOrientationChange,
    getSafeAreaInsets
};

// 自动初始化按钮反馈
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtonFeedback);
} else {
    setupButtonFeedback();
}
