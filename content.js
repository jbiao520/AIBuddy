let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";

// Define different prompt options
const promptOptions = [
  {
    name: "LLM",
    subMenu: [
      { 
        name: "解释内容", 
        prompt: "请解释以下内容："
      },
      { 
        name: "翻译内容", 
        prompt: "请翻译以下内容："
      },
      {
        name: "自定义提示...",
        isCustom: true
      }
    ]
  },
  {
    name: "API 调用",
    subMenu: [
      {
        name: "ArXiv搜索",
        isApi: true,
        apiUrl: "http://export.arxiv.org/api/query",
        method: "GET",
        params: {
            max_results: "5"  // 限制结果数量
        },
        paramName: "search_query"  // 选中的文字将作为search_query参数
      },
      {
        name: "pay查询",
        isApi: true,
        apiUrl: "http://localhost:7070/api/service2/payments",
        method: "POST",
        params: {
          "flow": "payment"
        },
        paramName: "id"  // 选中的文字将作为id参数
      },
      {
        name: "order查询",
        isApi: true,
        apiUrl: "http://localhost:7070/api/service1/orders",
        method: "POST",
        params: {
          "flow": "order"
        },
        paramName: "id"  // 选中的文字将作为id参数
      }
    ]
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
        console.log("保存的选中文本:", selectedTextContent);
        
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

// 修改发送到LLM的函数，确保关闭所有菜单
function sendToLLM(prompt, x, y) {
    // 关闭所有菜单
    removeAllMenus();
    
    // 立即显示一个空的响应弹窗
    showResponse("", x, y, true);
    
    // 获取刚创建的响应弹窗内容容器
    const contentContainer = document.querySelector('.ai-buddy-response-content');
    if (!contentContainer) {
        console.error("找不到响应内容容器");
        return;
    }
    
    // 创建光标容器和输出文本容器
    const outputContainer = document.createElement('div');
    outputContainer.className = 'ai-buddy-output-text';
    contentContainer.appendChild(outputContainer);
    
    // 创建一个固定在底部的光标容器
    const cursorContainer = document.createElement('div');
    cursorContainer.className = 'ai-buddy-cursor-container';
    contentContainer.appendChild(cursorContainer);
    
    // 添加光标
    const cursor = document.createElement('span');
    cursor.className = 'ai-buddy-cursor';
    cursor.textContent = '▋';
    cursorContainer.appendChild(cursor);
    
    // 变量跟踪是否用户手动滚动了
    let userHasScrolled = false;
    let lastScrollTop = 0;
    
    // 监听滚动事件
    contentContainer.addEventListener('scroll', () => {
        // 检测是否用户向上滚动
        if (contentContainer.scrollTop < lastScrollTop) {
            userHasScrolled = true;
        }
        
        // 检测是否滚动到底部
        const isAtBottom = contentContainer.scrollHeight - contentContainer.scrollTop <= contentContainer.clientHeight + 10;
        if (isAtBottom) {
            userHasScrolled = false;
        }
        
        lastScrollTop = contentContainer.scrollTop;
    });
    
    console.log("发送到LLM的提示:", prompt);
    
    // 发送请求到LLM，使用stream模式
    fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gemma3:12b",
            prompt: prompt,
            stream: true
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        
        // 函数：处理流数据
        function processStream() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    // 流结束，移除光标
                    if (cursorContainer.parentNode) {
                        cursorContainer.parentNode.removeChild(cursorContainer);
                    }
                    return;
                }
                
                // 解码接收到的数据
                const chunk = decoder.decode(value, { stream: true });
                
                try {
                    // 尝试解析JSON响应
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        const data = JSON.parse(line);
                        if (data.response) {
                            // 添加新文本到响应
                            fullResponse += data.response;
                            
                            // 渲染Markdown并更新显示
                            outputContainer.innerHTML = renderMarkdown(fullResponse);
                            
                            // 如果用户没有手动滚动，则自动滚动到底部
                            if (!userHasScrolled) {
                                contentContainer.scrollTop = contentContainer.scrollHeight;
                            }
                        }
                    }
                } catch (e) {
                    console.error("解析流数据错误:", e, "原始数据:", chunk);
                }
                
                // 继续处理流
                return processStream();
            });
        }
        
        // 开始处理流
        return processStream();
    })
    .catch(error => {
        console.error("LLM调用错误:", error);
        outputContainer.innerHTML = renderMarkdown("调用LLM时出错: " + error.message);
        
        // 移除光标
        if (cursorContainer.parentNode) {
            cursorContainer.parentNode.removeChild(cursorContainer);
        }
    });
}

// 确保弹窗宽度修改生效的方法
function updatePopupStyles() {
  // 1. 创建或获取样式元素
  let styleElement = document.getElementById('ai-buddy-custom-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'ai-buddy-custom-styles';
    document.head.appendChild(styleElement);
  }

  // 2. 定义更新的样式
  const updatedStyles = `
    .ai-buddy-response-popup {
      position: absolute !important;
      width: 600px !important;  /* 增加宽度 */
      max-width: 90vw !important; 
      max-height: 70vh !important;
      background-color: white !important;
      border-radius: 12px !important;
      padding: 24px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
      z-index: 10001 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      font-size: 15px !important;
      line-height: 1.6 !important;
      color: #333 !important;
    }
  `;

  // 3. 应用样式
  styleElement.textContent = updatedStyles;
  
  // 4. 更新任何现有弹窗的样式
  const existingPopups = document.querySelectorAll('.ai-buddy-response-popup');
  existingPopups.forEach(popup => {
    popup.style.width = '600px';
  });
  
  console.log("弹窗样式已更新");
}

// 在创建弹窗前调用此函数
updatePopupStyles();

// 修改showResponse函数，确保新样式应用
function showResponse(response, x, y, isStreaming = false, isHtml = false) {
  // 确保样式更新
  updatePopupStyles();
  
  // 移除现有的响应弹窗
  const existingPopups = document.querySelectorAll('.ai-buddy-response-popup');
  existingPopups.forEach(popup => {
    if (popup.parentNode) {
      popup.parentNode.removeChild(popup);
    }
  });
  
  const popup = document.createElement('div');
  popup.className = 'ai-buddy-response-popup';
  
  // 直接设置内联样式，确保宽度生效
  popup.style.width = '600px';
  popup.style.maxWidth = '90vw';
  
  // 创建顶部操作栏
  const actionBar = document.createElement('div');
  actionBar.className = 'ai-buddy-action-bar';
  
  // 添加操作按钮
  // ... 您现有的操作按钮代码 ...
  
  popup.appendChild(actionBar);
  
  // 创建内容容器
  const contentContainer = document.createElement('div');
  contentContainer.className = 'ai-buddy-response-content';
  
  // 如果不是流式输出，直接渲染全部内容
  if (!isStreaming) {
      if (isHtml) {
          // 如果是HTML内容，直接设置innerHTML
          contentContainer.innerHTML = response;
      } else {
          // 原来的markdown渲染
          contentContainer.innerHTML = renderMarkdown(response);
      }
  }
  // 如果是流式输出，内容会在流处理过程中逐步添加
  
  popup.appendChild(contentContainer);
  
  // 定位弹窗
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  popup.style.left = `${Math.min(x, viewportWidth - 500)}px`;
  popup.style.top = `${Math.min(y, viewportHeight - 400)}px`;
  
  // 添加关闭按钮
  const closeButton = document.createElement('button');
  closeButton.className = 'ai-buddy-close-button';
  closeButton.textContent = '×';
  closeButton.onclick = () => {
      if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
      }
  };
  popup.appendChild(closeButton);
  
  document.body.appendChild(popup);
  
  return contentContainer; // 返回内容容器，方便流式更新
}

// 添加光标动画的CSS
const cursorStyle = `
    .ai-buddy-cursor {
        display: inline-block;
        width: 0.6em;
        height: 1.2em;
        background-color: #333;
        margin-left: 2px;
        animation: blink 1s step-end infinite;
        vertical-align: text-bottom;
    }
    
    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
    }
`;

// 将光标样式添加到您现有的样式中
const styleElement = document.createElement('style');
styleElement.textContent = cursorStyle;
document.head.appendChild(styleElement);

// Show custom prompt input
function showCustomPromptInput(x, y) {
    // 移除现有的自定义提示框（如果存在）
    const existingPrompt = document.querySelector('.ai-buddy-custom-prompt');
    if (existingPrompt && existingPrompt.parentNode) {
        document.body.removeChild(existingPrompt);
    }

    // 移除菜单
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

    // 创建提交按钮
    const submitButton = document.createElement('button');
    submitButton.className = 'ai-buddy-custom-submit';
    submitButton.textContent = '提交';
    submitButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const customPromptText = inputField.value.trim();
        if (customPromptText) {
            // 先显示加载状态
            const loadingMessage = "正在处理您的请求...";
            showResponse(loadingMessage, x, y);
            
            // 移除自定义提示框
            if (customPromptContainer.parentNode) {
                document.body.removeChild(customPromptContainer);
            }
            
            // 确保我们仍然有选中的文本
            if (!selectedTextContent) {
                showResponse("错误: 找不到选中的文本", x, y);
                return;
            }
            
            console.log("发送到LLM的文本:", selectedTextContent);
            console.log("发送到LLM的提示:", customPromptText);
            
            // 组合提示文本和选中的内容
            const fullPrompt = customPromptText + " " + selectedTextContent;
            
            // 调用LLM
            fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gemma3:12b",
                    prompt: fullPrompt,
                    stream: false
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // 显示LLM响应
                showResponse(data.response || "无响应", x, y);
            })
            .catch(error => {
                console.error("LLM调用错误:", error);
                showResponse("调用LLM时出错: " + error.message, x, y);
            });
        }
    });
    buttonContainer.appendChild(submitButton);

    // 创建取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.className = 'ai-buddy-custom-cancel';
    cancelButton.textContent = '取消';
    cancelButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 移除自定义提示框
        if (customPromptContainer.parentNode) {
            document.body.removeChild(customPromptContainer);
        }
    });
    buttonContainer.appendChild(cancelButton);

    customPromptContainer.appendChild(buttonContainer);
    document.body.appendChild(customPromptContainer);

    // 聚焦输入框
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
            
            // 获取按钮位置
            let x = 0, y = 0;
            if (floatingButton) {
                x = parseInt(floatingButton.dataset.posX);
                y = parseInt(floatingButton.dataset.posY);
            }
            
            // 处理 API 调用
            if (option.isApi) {
                // 显示加载指示器
                menuItem.innerHTML = '⏳ ' + option.name;
                menuItem.style.pointerEvents = 'none';
                callExternalApi(option, selectedTextContent, x, y);
                return;
            }
            
            // 显示加载指示器
            menuItem.innerHTML = '⏳ ' + option.name;
            menuItem.style.pointerEvents = 'none';
            
            // 发送请求
            const fullPrompt = option.prompt + " " + selectedTextContent;
            sendToLLM(fullPrompt, x, y);
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

// 修改Markdown渲染函数，减少不必要的空行
function renderMarkdown(text) {
    // 首先移除多余的空行，将连续的空行替换为单个空行
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 处理代码块 (```code```)
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // 处理行内代码 (`code`)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理粗体 (**text**)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 处理斜体 (*text*)
    text = text.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    
    // 处理标题 (## Heading)
    text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // 处理链接 [text](url)
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 将文本分割成行，处理列表和段落
    let lines = text.split('\n');
    let result = [];
    let inList = false;
    let listType = '';
    let inParagraph = false;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // 跳过纯空行
        if (line === '') {
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
            }
            if (inParagraph) {
                result.push('</p>');
                inParagraph = false;
            }
            continue;
        }
        
        // 处理无序列表
        const ulMatch = line.match(/^[\*\-] (.*)$/);
        // 处理有序列表
        const olMatch = line.match(/^(\d+)\. (.*)$/);
        
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) {
                    result.push(`</${listType}>`);
                }
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push('<ul>');
                inList = true;
                listType = 'ul';
            }
            result.push(`<li>${ulMatch[1]}</li>`);
        }
        else if (olMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) {
                    result.push(`</${listType}>`);
                }
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push('<ol>');
                inList = true;
                listType = 'ol';
            }
            result.push(`<li>${olMatch[2]}</li>`);
        }
        else {
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
            }
            
            // 处理标题 (已在前面处理，这里只需要直接添加)
            if (line.startsWith('<h1>') || line.startsWith('<h2>') || line.startsWith('<h3>')) {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push(line);
            }
            // 处理引用块
            else if (line.startsWith('> ')) {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push(`<blockquote>${line.substring(2)}</blockquote>`);
            }
            // 处理水平线
            else if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/)) {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push('<hr>');
            }
            // 处理代码块 (已在前面处理，这里只需要直接添加)
            else if (line.startsWith('<pre>')) {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push(line);
            }
            // 普通段落
            else {
                if (!inParagraph) {
                    result.push('<p>');
                    inParagraph = true;
                } else {
                    // 如果已经在段落中，添加换行符
                    result.push('<br>');
                }
                result.push(line);
            }
        }
    }
    
    // 关闭最后一个打开的标签
    if (inList) {
        result.push(`</${listType}>`);
    }
    if (inParagraph) {
        result.push('</p>');
    }
    
    // 移除空标签和重复的标签
    let html = result.join('');
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><br><\/p>/g, '');
    
    return html;
}

// 添加一个函数来清理所有弹出元素
function removeAllPopups() {
    // 移除所有浮动按钮
    const floatingButtons = document.querySelectorAll('.ai-buddy-floating-button');
    floatingButtons.forEach(button => {
        if (button.parentNode) {
            button.parentNode.removeChild(button);
        }
    });
    
    // 移除所有菜单
    const menus = document.querySelectorAll('.ai-buddy-prompt-menu');
    menus.forEach(menu => {
        if (menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    });
    
    // 移除所有响应弹窗
    const popups = document.querySelectorAll('.ai-buddy-response-popup');
    popups.forEach(popup => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    });
    
    // 移除任何加载指示器或临时消息
    const loaders = document.querySelectorAll('.ai-buddy-loader, .ai-buddy-temp-message');
    loaders.forEach(loader => {
        if (loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    });
    
    // 重置全局变量
    floatingButton = null;
    promptMenu = null;
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

// 修改 showMenu 函数以支持子菜单
function showMenu(x, y, parentOption = null) {
    if (promptMenu) {
        document.body.removeChild(promptMenu);
        promptMenu = null;
    }
    
    promptMenu = document.createElement('div');
    promptMenu.className = 'ai-buddy-prompt-menu';
    promptMenu.style.left = x + 'px';
    promptMenu.style.top = y + 'px';
    
    const options = parentOption ? parentOption.subMenu : promptOptions;
    
    options.forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'ai-buddy-menu-item';
        
        if (option.subMenu) {
            item.innerHTML = `${option.name} <span class="menu-arrow">▶</span>`;
        } else {
            item.textContent = option.name;
        }
        
        // 处理子菜单悬停
        if (option.subMenu) {
            item.addEventListener('mouseenter', function(e) {
                const rect = item.getBoundingClientRect();
                showMenu(rect.right + window.scrollX, rect.top + window.scrollY, option);
            });
            
            // 有子菜单的项不需要点击处理
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
            });
        } else {
            // 处理点击事件
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log("Menu item clicked:", option); // 调试日志
                
                if (option.isApi) {
                    // API 调用处理
                    console.log("Calling API:", option.apiUrl);
                    callExternalApi(option, selectedTextContent, x, y);
                } else if (option.isCustom) {
                    showCustomPromptInput(x, y);
                } else {
                    // 普通 prompt 处理
                    sendToLLM(option.prompt + " " + selectedTextContent, x, y);
                }
            });
        }
        
        promptMenu.appendChild(item);
    });
    
    document.body.appendChild(promptMenu);
}

// API 调用函数
function callExternalApi(apiOption, text, x, y) {
    // 显示加载提示
    const loader = document.createElement('div');
    loader.className = 'ai-buddy-loader';
    loader.textContent = "正在处理...";
    loader.style.left = `${x}px`;
    loader.style.top = `${y}px`;
    document.body.appendChild(loader);
    
    // 移除菜单
    if (promptMenu && promptMenu.parentNode) {
        document.body.removeChild(promptMenu);
        promptMenu = null;
    }
    
    let url = apiOption.apiUrl;
    
    // 创建参数对象的副本
    let params = { ...apiOption.params };
    
    // 如果指定了特定的参数名，将选中文字放入该参数
    if (apiOption.paramName) {
        params[apiOption.paramName] = text;
    } else {
        // 默认将文字放入text参数
        params.text = text;
    }
    
    // 处理GET请求
    if (apiOption.method === 'GET') {
        const queryString = Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        url = `${url}?${queryString}`;
        
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/xml'  // ArXiv API返回XML
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();  // 获取XML响应
        })
        .then(data => {
            console.log("API response:", data);
            
            // 如果是ArXiv API，格式化XML为可读形式
            if (apiOption.apiUrl.includes('arxiv.org')) {
                const formattedResponse = formatArxivResponse(data);
                showResponse(formattedResponse, x, y);
            } else {
                showResponse(data, x, y);
            }
        })
        .catch(error => {
            console.error("API error:", error);
            showResponse("API调用失败: " + error.message, x, y);
        })
        .finally(() => {
            // 移除加载提示
            if (loader.parentNode) {
                document.body.removeChild(loader);
            }
            removeFloatingElements();
        });
    } else {
        // POST请求
        fetch(url, {
            method: apiOption.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(params)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("API response:", data);
            
            // 使用修改后的 formatJsonResponse 函数来处理 JSON 响应
            const formattedHtml = formatJsonResponse(data);
            
            // 使用现有的 showResponse 函数，但标记为 HTML 内容
            const responsePopup = document.querySelector('.ai-buddy-response-popup');
            if (responsePopup) {
                const contentContainer = responsePopup.querySelector('.ai-buddy-response-content');
                if (contentContainer) {
                    // 直接设置 HTML 内容
                    contentContainer.innerHTML = formattedHtml;
                } else {
                    showResponse(formattedHtml, x, y, false, true); // 添加参数表示这是HTML
                }
            } else {
                showResponse(formattedHtml, x, y, false, true); // 添加参数表示这是HTML
            }
        })
        .catch(error => {
            console.error("API error:", error);
            showResponse("API调用失败: " + error.message, x, y);
        })
        .finally(() => {
            // 移除加载提示
            if (loader.parentNode) {
                document.body.removeChild(loader);
            }
            removeFloatingElements();
        });
    }
}

// 格式化JSON响应
function formatJsonResponse(data) {
    try {
        // 创建一个包含摘要和折叠JSON的HTML字符串
        let html = '<div class="ai-buddy-summary-text">';
        
        // 提取关键信息作为摘要
        if (data.status) {
            html += `<strong>状态:</strong> ${data.status}<br>`;
        }
        if (data.id) {
            html += `<strong>ID:</strong> ${data.id}<br>`;
        }
        if (data.amount) {
            html += `<strong>金额:</strong> ${data.amount}<br>`;
        }
        if (data.total) {
            html += `<strong>总额:</strong> ${data.total}<br>`;
        }
        
        html += '</div>';
        
        // 添加折叠的JSON详情
        html += '<details class="ai-buddy-json-details">';
        html += '<summary>查看完整 JSON 数据</summary>';
        html += '<div class="json-tree">';
        html += renderJsonTree(data, 0, true); // 传递 true 表示第一层
        html += '</div>';
        html += '</details>';
        
        return html;
    } catch (e) {
        return "无法解析响应数据: " + e.message;
    }
}

// 新增函数: 渲染 JSON 树形结构
function renderJsonTree(data, level = 0, isFirstLevel = false) {
    if (data === null) {
        return '<span class="json-null">null</span>';
    }
    
    if (typeof data !== 'object') {
        // 处理基本类型
        if (typeof data === 'string') {
            return `<span class="json-string">"${escapeHtml(data)}"</span>`;
        }
        if (typeof data === 'number') {
            return `<span class="json-number">${data}</span>`;
        }
        if (typeof data === 'boolean') {
            return `<span class="json-boolean">${data}</span>`;
        }
        return escapeHtml(String(data));
    }
    
    // 处理数组或对象
    const isArray = Array.isArray(data);
    const openBracket = isArray ? '[' : '{';
    const closeBracket = isArray ? ']' : '}';
    
    if (Object.keys(data).length === 0) {
        return `${openBracket}${closeBracket}`;
    }
    
    let html = '';
    
    // 对象或数组有内容，创建一个可折叠的结构
    if (level > 0 || !isFirstLevel) {
        html += `<details ${isFirstLevel ? 'open' : ''}>`;
        html += `<summary>${openBracket}...</summary>`;
    } else {
        html += openBracket;
    }
    
    html += '<div style="margin-left: 20px;">';
    
    // 遍历对象的属性或数组的元素
    let i = 0;
    for (const key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        
        const value = data[key];
        const isLastItem = i === Object.keys(data).length - 1;
        const comma = isLastItem ? '' : ',';
        
        html += '<div>';
        
        if (!isArray) {
            // 显示键名 (对象的属性名)
            html += `<span class="json-key">"${escapeHtml(key)}"</span>: `;
        } else {
            // 数组索引可选显示
            // html += `<span class="json-key">${key}</span>: `;
        }
        
        // 递归渲染值
        html += renderJsonTree(value, level + 1);
        html += comma;
        html += '</div>';
        
        i++;
    }
    
    html += '</div>';
    
    if (level > 0 || !isFirstLevel) {
        html += `</details>`;
    } else {
        html += closeBracket;
    }
    
    return html;
}

// 辅助函数: 转义 HTML 特殊字符
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 格式化ArXiv API响应
function formatArxivResponse(xmlString) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        
        // 提取论文信息
        const entries = xmlDoc.getElementsByTagName("entry");
        let result = "";
        
        if (entries.length === 0) {
            return "未找到相关论文";
        }
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            // 获取标题、作者、摘要和链接
            const title = entry.getElementsByTagName("title")[0]?.textContent || "无标题";
            const published = entry.getElementsByTagName("published")[0]?.textContent || "";
            const summary = entry.getElementsByTagName("summary")[0]?.textContent || "无摘要";
            
            // 获取所有作者
            const authors = entry.getElementsByTagName("author");
            let authorList = "";
            for (let j = 0; j < authors.length; j++) {
                const name = authors[j].getElementsByTagName("name")[0]?.textContent || "";
                authorList += name + (j < authors.length - 1 ? ", " : "");
            }
            
            // 获取PDF链接
            const links = entry.getElementsByTagName("link");
            let pdfLink = "";
            for (let j = 0; j < links.length; j++) {
                if (links[j].getAttribute("title") === "pdf") {
                    pdfLink = links[j].getAttribute("href") || "";
                    break;
                }
            }
            
            // 格式化日期
            const pubDate = published ? new Date(published).toLocaleDateString() : "";
            
            // 构建论文信息块
            result += `论文 ${i+1}:\n`;
            result += `标题: ${title.trim()}\n`;
            result += `作者: ${authorList}\n`;
            if (pubDate) result += `发布日期: ${pubDate}\n`;
            if (pdfLink) result += `PDF链接: ${pdfLink}\n`;
            result += `摘要: ${summary.trim().substring(0, 300)}${summary.length > 300 ? "..." : ""}\n\n`;
        }
        
        return result;
    } catch (e) {
        console.error("Error parsing ArXiv response:", e);
        return "无法解析ArXiv响应数据: " + e.message;
    }
}

// 更新样式，使弹窗更宽并优化Markdown样式
const improvedStyles = `
    .ai-buddy-response-popup {
        position: absolute;
        width: 600px;  /* 增加宽度，原来是480px */
        max-width: 90vw; /* 保持响应式设计 */
        max-height: 70vh;
        background-color: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 15px;
        line-height: 1.6;
        color: #333;
    }

    .ai-buddy-response-content {
        position: relative;
        max-height: calc(70vh - 80px);
        overflow-y: auto;
        padding-right: 12px;
    }
    
    .ai-buddy-output-text {
        padding-bottom: 24px; /* 为光标留出空间 */
    }
    
    .ai-buddy-cursor-container {
        margin-top: 3px;
    }
    
    .ai-buddy-cursor {
        display: inline-block;
        width: 0.6em;
        height: 1.2em;
        background-color: #333;
        animation: blink 1s step-end infinite;
        vertical-align: text-bottom;
    }
    
    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
    }
`;

// 还可以添加额外的CSS来优化段落间距
const additionalCSS = `
    .ai-buddy-response-content p {
        margin-top: 0;
        margin-bottom: 10px;
    }
    
    .ai-buddy-response-content ul,
    .ai-buddy-response-content ol {
        margin-top: 4px;
        margin-bottom: 10px;
    }
    
    .ai-buddy-response-content h1,
    .ai-buddy-response-content h2,
    .ai-buddy-response-content h3 {
        margin-top: 16px;
        margin-bottom: 8px;
    }
    
    .ai-buddy-response-content h1:first-child,
    .ai-buddy-response-content h2:first-child,
    .ai-buddy-response-content h3:first-child {
        margin-top: 0;
    }
    
    .ai-buddy-response-content blockquote {
        margin: 10px 0;
    }
`;

// 将这段 CSS 添加到您现有的样式中

// 添加全局文档点击事件，清理所有UI元素
document.addEventListener('click', function(event) {
    if (!event.target.closest('.ai-buddy-floating-button') && 
        !event.target.closest('.ai-buddy-prompt-menu') && 
        !event.target.closest('.ai-buddy-response-popup') &&
        !event.target.closest('.ai-buddy-loader')) {
        removeAllPopups();
    }
});

// 添加ESC键监听，按ESC关闭所有弹窗
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        removeAllPopups();
    }
});

// 添加加载指示器样式
const loaderStyles = `
    .ai-buddy-loader {
        position: absolute;
        background-color: white;
        border-radius: 8px;
        padding: 12px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #333;
    }
`;

// 将加载指示器样式添加到您现有的样式中 

// 添加一个专门的函数来移除所有菜单
function removeAllMenus() {
    // 移除主菜单
    const mainMenus = document.querySelectorAll('.ai-buddy-prompt-menu, .ai-buddy-main-menu');
    mainMenus.forEach(menu => {
        if (menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    });
    
    // 移除子菜单
    const subMenus = document.querySelectorAll('.ai-buddy-submenu');
    subMenus.forEach(menu => {
        if (menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    });
    
    // 移除自定义提示框
    const customPrompts = document.querySelectorAll('.ai-buddy-custom-prompt');
    customPrompts.forEach(prompt => {
        if (prompt.parentNode) {
            prompt.parentNode.removeChild(prompt);
        }
    });
    
    // 重置菜单全局变量
    promptMenu = null;
}

// 在此处添加 API 返回的 JSON 折叠功能
const jsonDetailsStyles = `
    .ai-buddy-json-details {
        margin-top: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        overflow: hidden;
    }
    
    .ai-buddy-json-details summary {
        padding: 8px 12px;
        cursor: pointer;
        background-color: #f5f5f5;
        font-size: 14px;
        font-weight: 500;
        color: #555;
        user-select: none;
    }
    
    .ai-buddy-json-details summary:hover {
        background-color: #eaeaea;
    }
    
    .ai-buddy-json-content {
        max-height: 400px;
        overflow: auto;
        padding: 12px;
        background-color: #f9f9f9;
        font-family: monospace;
        font-size: 13px;
        white-space: pre-wrap;
    }
    
    .ai-buddy-summary-text {
        margin-bottom: 12px;
        font-size: 15px;
        line-height: 1.5;
    }
    
    /* 嵌套的 JSON 对象样式 */
    .json-tree {
        font-family: monospace;
        font-size: 13px;
        line-height: 1.4;
    }
    
    .json-tree details {
        margin-left: 20px;
    }
    
    .json-tree summary {
        cursor: pointer;
        color: #555;
        background-color: transparent;
        padding: 2px 5px;
        border-radius: 3px;
    }
    
    .json-tree summary:hover {
        background-color: rgba(0,0,0,0.05);
    }
    
    .json-key {
        color: #881391;
        font-weight: bold;
    }
    
    .json-string {
        color: #1a1aa6;
    }
    
    .json-number {
        color: #1c6e00;
    }
    
    .json-boolean {
        color: #0d22aa;
    }
    
    .json-null {
        color: #777;
    }
`;

// 添加 JSON 折叠样式到文档中
const jsonStyleElement = document.createElement('style');
jsonStyleElement.textContent = jsonDetailsStyles;
document.head.appendChild(jsonStyleElement);

// 将这段 CSS 添加到您现有的样式中
// ... remaining existing code ... 