let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";

// Define different prompt options
const promptOptions = [
  { 
    name: "解释内容", 
    subMenu: [
      { name: "详细解释", prompt: "请详细解释以下内容的每个要点：" },
      { name: "简单解释", prompt: "请用简单的话解释这段内容：" },
      { name: "类比解释", prompt: "请用生动的类比来解释这段内容：" }
    ]
  },
  { 
    name: "总结内容", 
    subMenu: [
      { name: "要点总结", prompt: "请总结以下内容的主要观点：" },
      { name: "结构化总结", prompt: "请用结构化的方式总结这段内容：" },
      { name: "一句话总结", prompt: "请用一句话总结这段内容的核心意思：" }
    ]
  },
  { 
    name: "翻译内容", 
    subMenu: [
      { name: "翻译成中文", prompt: "请将以下内容翻译成中文：" },
      { name: "翻译成英文", prompt: "请将以下内容翻译成英文：" },
      { name: "意译", prompt: "请意译以下内容，保持原意但使表达更通顺：" }
    ]
  },
  { 
    name: "分析内容", 
    subMenu: [
      { name: "逻辑分析", prompt: "请分析以下内容的逻辑结构：" },
      { name: "批判性分析", prompt: "请对以下内容进行批判性分析：" },
      { name: "深度解读", prompt: "请深入解读以下内容的含义：" }
    ]
  },
  {
    name: "自定义提示...", 
    isCustom: true
  }
];

// Text selection event
document.addEventListener('mouseup', (event) => {
    // Delay processing to wait for selection to complete
    setTimeout(() => {
        const selectedText = window.getSelection().toString().trim();
        
        // Don't do anything if clicking on floating button or menu
        if (event.target.closest('.ai-buddy-floating-button') || 
            event.target.closest('.ai-buddy-prompt-menu')) {
            return;
        }
        
        // Remove existing floating button
        if (floatingButton && floatingButton.parentNode) {
            document.body.removeChild(floatingButton);
            floatingButton = null;
        }
        
        // Save selected text
        selectedTextContent = selectedText;
        
        if (selectedText.length > 0) {
            // Create floating button
            floatingButton = document.createElement('div');
            floatingButton.className = 'ai-buddy-floating-button';
            floatingButton.innerHTML = '🤖';
            
            // Position button near mouse
            const x = event.pageX + 10;
            const y = event.pageY - 30;
            
            floatingButton.style.left = `${x}px`;
            floatingButton.style.top = `${y}px`;
            
            // Mark button position for menu positioning
            floatingButton.dataset.posX = x;
            floatingButton.dataset.posY = y;
            
            // Add click event
            floatingButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Show main menu
                const buttonRect = floatingButton.getBoundingClientRect();
                const menuX = buttonRect.left;
                const menuY = buttonRect.bottom + 5;
                
                createPromptMenu(selectedTextContent, menuX, menuY);
            });
            
            document.body.appendChild(floatingButton);
        }
    }, 50);
});

// Listen for clicks on the entire document
document.addEventListener('click', (event) => {
    // 只有当点击不在任何菜单内时才关闭所有菜单
    if (!event.target.closest('.ai-buddy-prompt-menu') && 
        !event.target.closest('.ai-buddy-floating-button')) {
        removeFloatingElements();
    }
});

// Function to send prompt to LLM
function sendPromptToLLM(prompt, x, y) {
    console.log("Sending request to background script, prompt:", prompt);
    
    // Send request via background script
    chrome.runtime.sendMessage(
        {
            type: 'getAIResponse',
            text: prompt
        },
        function(response) {
            console.log("Received response from background script:", response);
            
            if (chrome.runtime.lastError) {
                console.error("Chrome runtime error:", chrome.runtime.lastError);
                showResponsePopup("Error: " + chrome.runtime.lastError.message, x, y);
            } else {
                // More flexible response handling
                let responseText = "";
                
                if (response && response.success && response.data) {
                    responseText = response.data;
                } else if (response && response.data) {
                    responseText = response.data;
                } else if (response && response.response) {
                    responseText = response.response;
                } else if (typeof response === 'string') {
                    responseText = response;
                } else if (response && response.error) {
                    responseText = "Error: " + response.error;
                } else if (response) {
                    // Try to convert entire response object to string
                    try {
                        responseText = "Raw response: " + JSON.stringify(response);
                    } catch (e) {
                        responseText = "Received response in unknown format";
                    }
                } else {
                    responseText = "No response received";
                }
                
                showResponsePopup(responseText, x, y);
            }
            
            // Remove floating elements
            removeFloatingElements();
        }
    );
}

// Show custom prompt input
function showCustomPromptInput(x, y) {
    // Remove menu
    if (promptMenu && promptMenu.parentNode) {
        document.body.removeChild(promptMenu);
        promptMenu = null;
    }
    
    const customPromptContainer = document.createElement('div');
    customPromptContainer.className = 'ai-buddy-custom-prompt';
    customPromptContainer.style.left = `${x}px`;
    customPromptContainer.style.top = `${y + 40}px`;
    
    const inputLabel = document.createElement('div');
    inputLabel.className = 'ai-buddy-custom-label';
    inputLabel.textContent = '输入自定义提示:';
    customPromptContainer.appendChild(inputLabel);
    
    const inputField = document.createElement('textarea');
    inputField.className = 'ai-buddy-custom-input';
    inputField.placeholder = '例如: 请帮我分析这段文字...';
    inputField.rows = 3;
    customPromptContainer.appendChild(inputField);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'ai-buddy-custom-buttons';
    
    const submitButton = document.createElement('button');
    submitButton.className = 'ai-buddy-custom-submit';
    submitButton.textContent = '提交';
    buttonContainer.appendChild(submitButton);
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'ai-buddy-custom-cancel';
    cancelButton.textContent = '取消';
    buttonContainer.appendChild(cancelButton);
    
    customPromptContainer.appendChild(buttonContainer);
    document.body.appendChild(customPromptContainer);
    
    // Focus the input field
    inputField.focus();
}

// Create prompt options menu
function createPromptMenu(selectedText, x, y, parentOption = null, isSubmenu = false) {
    // 如果是创建子菜单，不要移除父菜单
    if (!isSubmenu) {
        removeAllSubmenus();
    }

    const menu = document.createElement('div');
    menu.className = 'ai-buddy-prompt-menu';
    
    if (isSubmenu) {
        menu.classList.add('ai-buddy-submenu');
    } else {
        menu.classList.add('ai-buddy-main-menu');
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const options = parentOption ? parentOption.subMenu : promptOptions;
    
    options.forEach((option, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'ai-buddy-menu-item';
        
        if (option.subMenu) {
            menuItem.innerHTML = `${option.name} <span class="menu-arrow">▶</span>`;
            menuItem.classList.add('has-submenu');
        } else {
            menuItem.textContent = option.name;
        }
        
        menuItem.dataset.index = index;
        
        // 处理鼠标悬停事件
        if (option.subMenu) {
            let submenuTimeout;
            
            menuItem.addEventListener('mouseenter', (e) => {
                clearTimeout(submenuTimeout);
                removeAllSubmenus();
                
                const rect = menuItem.getBoundingClientRect();
                const scrollX = window.scrollX;
                const scrollY = window.scrollY;
                
                createPromptMenu(selectedText, rect.right + scrollX, rect.top + scrollY, option, true);
            });

            menuItem.addEventListener('mouseleave', (e) => {
                const relatedTarget = e.relatedTarget;
                if (!relatedTarget || (!relatedTarget.closest('.ai-buddy-submenu') && !relatedTarget.closest('.has-submenu'))) {
                    submenuTimeout = setTimeout(() => {
                        if (!document.querySelector('.ai-buddy-submenu:hover')) {
                            removeAllSubmenus();
                        }
                    }, 100);
                }
            });
        }
        
        // 处理点击事件
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (option.subMenu) {
                // 如果有子菜单，不执行任何操作
                return;
            }
            
            if (option.isCustom) {
                showCustomPromptInput(
                    parseInt(floatingButton.dataset.posX),
                    parseInt(floatingButton.dataset.posY)
                );
                return;
            }
            
            // 显示加载指示器
            menuItem.innerHTML = '⏳ ' + option.name;
            menuItem.style.pointerEvents = 'none';
            
            // 获取按钮位置
            let x = 0, y = 0;
            if (floatingButton) {
                x = parseInt(floatingButton.dataset.posX);
                y = parseInt(floatingButton.dataset.posY);
            }
            
            // 发送请求
            const fullPrompt = option.prompt + " " + selectedTextContent;
            sendPromptToLLM(fullPrompt, x, y);
        });
        
        menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    if (isSubmenu) {
        menu.dataset.isSubmenu = 'true';
    } else {
        promptMenu = menu;
    }

    adjustMenuPosition(menu);
}

// 调整菜单位置，确保在视窗内
function adjustMenuPosition(menu) {
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 检查右边界
    if (rect.right > viewportWidth) {
        const overflowX = rect.right - viewportWidth;
        menu.style.left = `${parseInt(menu.style.left) - overflowX - 10}px`;
    }
    
    // 检查下边界
    if (rect.bottom > viewportHeight) {
        const overflowY = rect.bottom - viewportHeight;
        menu.style.top = `${parseInt(menu.style.top) - overflowY - 10}px`;
    }
}

// 移除所有子菜单
function removeAllSubmenus() {
    const submenus = document.querySelectorAll('.ai-buddy-submenu');
    submenus.forEach(submenu => {
        if (submenu.parentNode) {
            submenu.parentNode.removeChild(submenu);
        }
    });
}

// Remove all floating elements
function removeFloatingElements() {
    if (floatingButton && floatingButton.parentNode) {
        document.body.removeChild(floatingButton);
        floatingButton = null;
    }
    
    if (promptMenu && promptMenu.parentNode) {
        document.body.removeChild(promptMenu);
        promptMenu = null;
    }
    
    removeAllSubmenus();
}

function showResponsePopup(response, x, y) {
    const popup = document.createElement('div');
    popup.className = 'ai-buddy-response-popup';
    
    // Create content container with scrolling
    const contentContainer = document.createElement('div');
    contentContainer.className = 'ai-buddy-response-content';
    contentContainer.textContent = response;
    popup.appendChild(contentContainer);
    
    // Position popup
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    
    // Add close button
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

// 辅助函数：根据菜单项元素查找对应的选项
function findOptionByElement(element) {
    const index = parseInt(element.dataset.index);
    const parentMenu = element.closest('.ai-buddy-prompt-menu');
    const isSubmenu = parentMenu !== promptMenu;
    
    if (isSubmenu) {
        // 遍历查找父菜单项的子菜单选项
        for (const option of promptOptions) {
            if (option.subMenu) {
                const subOption = option.subMenu[index];
                if (subOption) return subOption;
            }
        }
    } else {
        return promptOptions[index];
    }
    
    return null;
} 