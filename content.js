let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";

// 定义不同的prompt选项
const promptOptions = [
  { 
    name: "解释内容", 
    prompt: "请解释以下内容：" 
  },
  { 
    name: "总结内容", 
    prompt: "请总结以下关键点：" 
  },
  { 
    name: "简化表达", 
    prompt: "请用更简单的语言重写以下内容：" 
  },
  { 
    name: "翻译成中文", 
    prompt: "请将以下内容翻译成中文：" 
  },
  { 
    name: "批判性分析", 
    prompt: "请对以下内容进行批判性分析：" 
  }
];

// 文本选择事件
document.addEventListener('mouseup', (event) => {
    // 延迟处理，等待选择完成
    setTimeout(() => {
        const selectedText = window.getSelection().toString().trim();
        
        // 如果点击了浮动按钮或菜单，不执行任何操作
        if (event.target.closest('.ai-buddy-floating-button') || 
            event.target.closest('.ai-buddy-prompt-menu')) {
            return;
        }
        
        // 移除现有的浮动按钮
        if (floatingButton && floatingButton.parentNode) {
            document.body.removeChild(floatingButton);
            floatingButton = null;
        }
        
        // 保存选中文本
        selectedTextContent = selectedText;
        
        if (selectedText.length > 0) {
            // 创建浮动按钮
            floatingButton = document.createElement('div');
            floatingButton.className = 'ai-buddy-floating-button';
            floatingButton.innerHTML = '🤖';
            
            // 定位按钮在鼠标附近
            const x = event.pageX + 10;
            const y = event.pageY - 30;
            
            floatingButton.style.left = `${x}px`;
            floatingButton.style.top = `${y}px`;
            
            // 标记按钮的位置，用于后续菜单定位
            floatingButton.dataset.posX = x;
            floatingButton.dataset.posY = y;
            
            document.body.appendChild(floatingButton);
        }
    }, 50);
});

// 监听整个文档的点击事件
document.addEventListener('click', (event) => {
    // 处理点击浮动按钮的情况
    if (event.target.closest('.ai-buddy-floating-button')) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.ai-buddy-floating-button');
        const x = parseInt(button.dataset.posX);
        const y = parseInt(button.dataset.posY);
        
        // 如果菜单已存在，移除它
        if (promptMenu && promptMenu.parentNode) {
            document.body.removeChild(promptMenu);
            promptMenu = null;
        } else {
            // 否则创建菜单
            createPromptMenu(selectedTextContent, x, y + 40);
        }
        return;
    }
    
    // 处理点击菜单项的情况
    if (event.target.closest('.ai-buddy-menu-item')) {
        event.preventDefault();
        event.stopPropagation();
        
        const menuItem = event.target.closest('.ai-buddy-menu-item');
        const optionIndex = parseInt(menuItem.dataset.index);
        const option = promptOptions[optionIndex];
        
        // 显示加载指示器
        menuItem.innerHTML = '⏳ ' + option.name;
        menuItem.style.pointerEvents = 'none';
        
        // 获取按钮位置
        let x = 0, y = 0;
        if (floatingButton) {
            x = parseInt(floatingButton.dataset.posX);
            y = parseInt(floatingButton.dataset.posY);
        }
        
        // 组合prompt和选中的文本
        const fullPrompt = option.prompt + " " + selectedTextContent;
        
        // 通过background script发送请求
        chrome.runtime.sendMessage(
            {
                type: 'getAIResponse',
                text: fullPrompt
            },
            function(response) {
                console.log("Response from background script:", response);
                
                if (chrome.runtime.lastError) {
                    console.error("Chrome runtime error:", chrome.runtime.lastError);
                    showResponsePopup("Error: " + chrome.runtime.lastError.message, x, y);
                } else if (response && response.success && response.data) {
                    showResponsePopup(response.data, x, y);
                } else if (response && !response.success) {
                    showResponsePopup("Error: " + (response.error || "Unknown error"), x, y);
                } else {
                    showResponsePopup("Unexpected response format", x, y);
                }
                
                // 移除浮动元素
                removeFloatingElements();
            }
        );
        return;
    }
    
    // 点击其他区域时，清除浮动元素
    if (!event.target.closest('.ai-buddy-response-popup')) {
        removeFloatingElements();
    }
});

// 创建prompt选项菜单
function createPromptMenu(selectedText, x, y) {
    promptMenu = document.createElement('div');
    promptMenu.className = 'ai-buddy-prompt-menu';
    promptMenu.style.left = `${x}px`;
    promptMenu.style.top = `${y}px`;
    
    // 为每个prompt选项创建一个菜单项
    promptOptions.forEach((option, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'ai-buddy-menu-item';
        menuItem.textContent = option.name;
        menuItem.dataset.index = index; // 存储选项索引
        
        promptMenu.appendChild(menuItem);
    });
    
    document.body.appendChild(promptMenu);
}

// 移除所有浮动元素
function removeFloatingElements() {
    if (floatingButton && floatingButton.parentNode) {
        document.body.removeChild(floatingButton);
        floatingButton = null;
    }
    
    if (promptMenu && promptMenu.parentNode) {
        document.body.removeChild(promptMenu);
        promptMenu = null;
    }
}

function showResponsePopup(response, x, y) {
    const popup = document.createElement('div');
    popup.className = 'ai-buddy-response-popup';
    
    // 创建内容容器，使其支持滚动
    const contentContainer = document.createElement('div');
    contentContainer.className = 'ai-buddy-response-content';
    contentContainer.textContent = response;
    popup.appendChild(contentContainer);
    
    // 定位弹窗
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    
    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.className = 'ai-buddy-close-button';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (popup.parentNode) {
            document.body.removeChild(popup);
        }
    });
    popup.appendChild(closeButton);
    
    document.body.appendChild(popup);
} 