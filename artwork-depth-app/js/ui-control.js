/**
 * UI 控制脚本
 * 实现按钮显示/隐藏功能（点击屏幕切换）
 */

class UIController {
    constructor() {
        this.uiOverlay = null;
        this.isVisible = true;
        this.autoHideDelay = 3000; // 3秒后自动隐藏
        this.autoHideTimer = null;
        this.isActive = false; // 是否已激活（图片已加载或AR已开启）
        
        this.init();
    }
    
    init() {
        // 查找 UI 覆盖层（支持多种选择器）
        this.uiOverlay = document.querySelector('.ui-overlay') || 
                         document.querySelector('#controls-panel') ||
                         document.querySelector('.controls');
        if (!this.uiOverlay) {
            // 如果没有找到，不初始化（某些页面可能不需要）
            return;
        }
        
        // 监听点击事件（切换显示/隐藏）
        document.addEventListener('click', (e) => {
            // 如果点击的是按钮本身或输入框，不切换
            if (e.target.closest('.ui-overlay') || 
                e.target.closest('#controls-panel') ||
                e.target.closest('.controls') ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'BUTTON' ||
                e.target.tagName === 'LABEL') {
                return;
            }
            
            // 只有在激活状态下才切换
            if (this.isActive) {
                this.toggle();
            }
        });
        
        // 监听触摸事件（移动端）
        document.addEventListener('touchend', (e) => {
            if (e.target.closest('.ui-overlay') || 
                e.target.closest('#controls-panel') ||
                e.target.closest('.controls') ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'BUTTON' ||
                e.target.tagName === 'LABEL') {
                return;
            }
            
            if (this.isActive) {
                this.toggle();
            }
        });
        
        // 初始状态：显示
        this.show();
    }
    
    // 激活（图片已加载或AR已开启）
    activate() {
        this.isActive = true;
        // 激活后延迟隐藏
        this.scheduleAutoHide();
    }
    
    // 显示
    show() {
        if (!this.uiOverlay) return;
        this.isVisible = true;
        
        // 检查是否是 controls 面板（使用 classList）
        if (this.uiOverlay.id === 'controls-panel' || this.uiOverlay.classList.contains('controls')) {
            this.uiOverlay.classList.remove('hidden');
        } else {
            // 标准 ui-overlay
            this.uiOverlay.style.opacity = '1';
            this.uiOverlay.style.pointerEvents = 'auto';
            this.uiOverlay.style.transform = 'translateX(-50%) translateY(0)';
        }
    }
    
    // 隐藏
    hide() {
        if (!this.uiOverlay) return;
        this.isVisible = false;
        
        // 检查是否是 controls 面板（使用 classList）
        if (this.uiOverlay.id === 'controls-panel' || this.uiOverlay.classList.contains('controls')) {
            this.uiOverlay.classList.add('hidden');
        } else {
            // 标准 ui-overlay
            this.uiOverlay.style.opacity = '0';
            this.uiOverlay.style.pointerEvents = 'none';
            this.uiOverlay.style.transform = 'translateX(-50%) translateY(20px)';
        }
    }
    
    // 切换显示/隐藏
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
            // 显示后延迟自动隐藏
            this.scheduleAutoHide();
        }
    }
    
    // 安排自动隐藏
    scheduleAutoHide() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
        }
        
        this.autoHideTimer = setTimeout(() => {
            if (this.isVisible && this.isActive) {
                this.hide();
            }
        }, this.autoHideDelay);
    }
    
    // 取消自动隐藏
    cancelAutoHide() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
    }
}

// 创建全局实例
window.uiController = new UIController();
