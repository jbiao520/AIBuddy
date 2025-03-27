let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";
let domainPrompts = {}; // 保存域名与系统提示的映射关系

// 动态加载CSS样式
function loadStyles() {
  const styleElement = document.createElement('link');
  styleElement.rel = 'stylesheet';
  styleElement.href = chrome.runtime.getURL('styles.css');
  document.head.appendChild(styleElement);
  
  console.log("AI Buddy 样式已加载");
}

// 初始化时加载样式
loadStyles();

// 导入提示选项配置
let promptOptions = [];

// 动态加载提示配置
function loadPromptConfig() {
  // 使用 Chrome 扩展 API 获取配置文件 URL
  const configUrl = chrome.runtime.getURL('prompt-config.js');
  
  // 动态导入配置模块
  import(configUrl)
    .then(module => {
      promptOptions = module.promptOptions;
      domainPrompts = module.domainPrompts;
      console.log("AI Buddy 提示配置已加载");
    })
    .catch(error => {
      console.error("加载提示配置失败:", error);
      // 使用默认配置
      promptOptions = getDefaultConfig();
      domainPrompts = { "default": "请分析以下内容：" };
    });
}

// 默认配置函数，作为备用
function getDefaultConfig() {
  return [
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
        }
      ]
    }
  ];
}

// 初始化时加载提示配置
loadPromptConfig();

// 添加复制事件监听，支持键盘复制后触发
document.addEventListener('copy', (event) => {
  setTimeout(() => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
      // 移除现有浮动按钮
      if (floatingButton && floatingButton.parentNode) {
        document.body.removeChild(floatingButton);
        floatingButton = null;
      }
      
      // 保存选中文本
      selectedTextContent = selectedText;
      
      // 计算最佳按钮位置
      const position = calculateButtonPosition(window.getSelection());
      
      // 创建浮动按钮
      floatingButton = createFloatingButtonWithTooltip(position.x, position.y, selectedText);
    }
  }, 100);
});

// 添加键盘事件监听，捕获复制快捷键
document.addEventListener('keydown', (event) => {
  // 检测Ctrl+C 或 Command+C (Mac)
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    // 在下一个事件循环中处理，确保复制命令已执行
    setTimeout(() => {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText.length > 0) {
        // 保存选中的文本
        selectedTextContent = selectedText;
        console.log("通过复制快捷键保存的文本:", selectedTextContent);
        
        // 检查是否已存在浮动按钮，避免重复创建
        if (!floatingButton || !document.body.contains(floatingButton)) {
          // 获取选中文本的位置
          const selection = window.getSelection();
          let rect;
          
          if (selection.rangeCount > 0) {
            rect = selection.getRangeAt(0).getBoundingClientRect();
          } else {
            rect = {
              left: window.innerWidth / 2 - 30,
              top: window.innerHeight / 2 - 30,
              right: window.innerWidth / 2 + 30,
              bottom: window.innerHeight / 2 + 30
            };
          }
          
          // 计算按钮位置
          const x = rect.right + window.scrollX + 10;
          const y = rect.top + window.scrollY - 30;
          
          // 创建带工具提示的浮动按钮
          floatingButton = createFloatingButtonWithTooltip(x, y, selectedText);
        }
      }
    }, 100);
  }
});

// 创建带工具提示的浮动按钮
function createFloatingButtonWithTooltip(x, y, text) {
  // 创建浮动按钮
  const button = document.createElement('div');
  button.className = 'ai-buddy-floating-button';
  button.innerHTML = '🤖';
  
  button.style.left = `${x}px`;
  button.style.top = `${y}px`;
  
  // 存储位置数据
  button.dataset.posX = x;
  button.dataset.posY = y;
  
  // 创建工具提示
  const tooltip = document.createElement('div');
  tooltip.className = 'ai-buddy-tooltip';
  tooltip.textContent = '点击使用AI助手解析复制内容';
  tooltip.style.opacity = '0';
  
  // 添加工具提示到按钮
  button.appendChild(tooltip);
  
  // 添加鼠标悬停显示工具提示
  button.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
  });
  
  button.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
  });
  
  // 添加点击事件
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const buttonRect = button.getBoundingClientRect();
    const menuX = buttonRect.left + window.scrollX;
    const menuY = buttonRect.bottom + window.scrollY + 5;
    
    createPromptMenu(text, menuX, menuY);
  });
  
  document.body.appendChild(button);
  
  // 确保按钮在视口内
  adjustElementPosition(button, x, y);
  
  return button;
}

// 添加工具提示样式
const tooltipStyles = `
  .ai-buddy-tooltip {
    position: absolute;
    background-color: #333;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 10px;
    pointer-events: none;
    transition: opacity 0.3s;
    z-index: 10002;
  }
  
  .ai-buddy-tooltip:before {
    content: '';
    position: absolute;
    left: -5px;
    top: 50%;
    transform: translateY(-50%);
    border-width: 5px 5px 5px 0;
    border-style: solid;
    border-color: transparent #333 transparent transparent;
  }
  
  /* 添加响应式处理，确保工具提示在右侧空间不足时显示在左侧 */
  @media (max-width: 768px) {
    .ai-buddy-floating-button:hover .ai-buddy-tooltip {
      left: auto;
      right: 100%;
      margin-left: 0;
      margin-right: 10px;
    }
    
    .ai-buddy-floating-button:hover .ai-buddy-tooltip:before {
      left: auto;
      right: -5px;
      border-width: 5px 0 5px 5px;
      border-color: transparent transparent transparent #333;
    }
  }
`;

// 将工具提示样式添加到文档
const tooltipStyleElement = document.createElement('style');
tooltipStyleElement.textContent = tooltipStyles;
document.head.appendChild(tooltipStyleElement);

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
            
            // Position button near mouse, using pageX/Y which includes scroll position
            const x = event.pageX + 10;
            const y = event.pageY - 30;
            
            floatingButton.style.left = `${x}px`;
            floatingButton.style.top = `${y}px`;
            
            // Store both page coordinates (including scroll) for future use
            floatingButton.dataset.posX = x;
            floatingButton.dataset.posY = y;
            
            // Add click event
            floatingButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Get current button position (including any scrolling that happened)
                const buttonRect = floatingButton.getBoundingClientRect();
                const menuX = buttonRect.left + window.scrollX;
                const menuY = buttonRect.bottom + window.scrollY + 5;
                
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

// 完全重写 sendToLLM 函数，确保弹窗始终居中显示
function sendToLLM(prompt, x, y, appendToExisting = false) {
    // 关闭所有菜单
    removeAllMenus();
    
    // 创建 AbortController 实例
    const controller = new AbortController();
    const signal = controller.signal;
    
    let existingPopup = null;
    let contentContainer = null;
    
    // 使用屏幕中心坐标
    const centerX = window.innerWidth / 2 + window.scrollX;
    const centerY = window.innerHeight / 2 + window.scrollY;
    
    // 检查是否需要在现有弹窗中追加内容
    if (appendToExisting) {
        existingPopup = document.querySelector('.ai-buddy-response-popup');
        if (existingPopup) {
            contentContainer = existingPopup.querySelector('.ai-buddy-response-content');
            centerElementOnScreen(existingPopup);
        }
    }
    
    // 如果没有现有的弹窗或内容容器，创建一个新的
    if (!existingPopup || !contentContainer) {
        contentContainer = showResponse("", centerX, centerY, true);
        existingPopup = document.querySelector('.ai-buddy-response-popup');
        if (existingPopup) {
            centerElementOnScreen(existingPopup);
        }
    }
    
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
    
    // 获取操作栏
    const actionBar = existingPopup.querySelector('.ai-buddy-action-bar');
    
    // 清理操作栏，移除所有已完成/已取消的按钮
    if (actionBar) {
        const oldButtons = actionBar.querySelectorAll('.ai-buddy-stop-button.completed, .ai-buddy-stop-button.stopped');
        oldButtons.forEach(btn => {
            actionBar.removeChild(btn);
        });
        
        // 移除之前的复制按钮，后面会根据需要重新添加
        const oldCopyButtons = actionBar.querySelectorAll('.ai-buddy-copy-button');
        oldCopyButtons.forEach(btn => {
            actionBar.removeChild(btn);
        });
    }
    
    // 添加新的终止按钮
    const stopButton = document.createElement('button');
    stopButton.className = 'ai-buddy-stop-button';
    stopButton.textContent = '终止输出';
    stopButton.onclick = () => {
        controller.abort();
        stopButton.textContent = '已终止';
        stopButton.disabled = true;
        stopButton.classList.add('stopped');
        if (cursorContainer.parentNode) {
            cursorContainer.parentNode.removeChild(cursorContainer);
        }
        
        // 流结束时显示复制按钮
        if (actionBar && !actionBar.querySelector('.ai-buddy-copy-button')) {
            createCopyButton(actionBar, outputContainer);
        }
        
        // 启用跟进输入框
        enableFollowupInput();
    };
    
    if (actionBar) {
        actionBar.appendChild(stopButton);
    }
    
    // 禁用跟进输入框，直到回答完成
    disableFollowupInput();
    
    // 变量跟踪是否用户手动滚动了
    let userHasScrolled = false;
    let lastScrollTop = contentContainer.scrollTop;
    
    // 监听滚动事件
    const scrollHandler = () => {
        if (contentContainer.scrollTop < lastScrollTop) {
            userHasScrolled = true;
        }
        const isAtBottom = contentContainer.scrollHeight - contentContainer.scrollTop <= contentContainer.clientHeight + 10;
        if (isAtBottom) {
            userHasScrolled = false;
        }
        lastScrollTop = contentContainer.scrollTop;
    };
    
    contentContainer.addEventListener('scroll', scrollHandler);
    
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
        }),
        signal // 添加 signal 到 fetch 请求
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
                    
                    // 移除终止按钮，避免累积
                    if (actionBar && stopButton.parentNode === actionBar) {
                        actionBar.removeChild(stopButton);
                    }
                    
                    // 添加复制按钮
                    if (actionBar && !actionBar.querySelector('.ai-buddy-copy-button')) {
                        createCopyButton(actionBar, contentContainer);
                    }
                    
                    // 启用跟进输入框
                    enableFollowupInput();
                    
                    // 如果是新弹窗，自动聚焦到跟进输入框
                    if (!appendToExisting) {
                        const followupInput = existingPopup.querySelector('.ai-buddy-followup-input');
                        if (followupInput) {
                            followupInput.focus();
                        }
                    }
                    
                    // 确保弹窗居中
                    centerElementOnScreen(existingPopup);
                    
                    return;
                }
                
                // 解码接收到的数据
                const chunk = decoder.decode(value, { stream: true });
                
                try {
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        const data = JSON.parse(line);
                        if (data.response) {
                            fullResponse += data.response;
                            outputContainer.innerHTML = renderMarkdown(fullResponse);
                            
                            if (!userHasScrolled) {
                                contentContainer.scrollTop = contentContainer.scrollHeight;
                            }
                        }
                    }
                } catch (e) {
                    console.error("解析流数据错误:", e, "原始数据:", chunk);
                }
                
                return processStream();
            });
        }
        
        return processStream();
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted');
            outputContainer.innerHTML += renderMarkdown("\n\n[输出已终止]");
        } else {
            console.error("LLM调用错误:", error);
            outputContainer.innerHTML = renderMarkdown("调用LLM时出错: " + error.message);
            
            // 移除终止按钮
            if (actionBar && stopButton.parentNode === actionBar) {
                actionBar.removeChild(stopButton);
            }
        }
        
        // 移除光标
        if (cursorContainer.parentNode) {
            cursorContainer.parentNode.removeChild(cursorContainer);
        }
        
        // 错误情况下也显示复制按钮
        if (actionBar && !actionBar.querySelector('.ai-buddy-copy-button') && outputContainer.textContent.trim()) {
            createCopyButton(actionBar, contentContainer);
        }
        
        // 启用跟进输入框
        enableFollowupInput();
        
        // 确保弹窗居中
        centerElementOnScreen(existingPopup);
    });
}

// 禁用跟进输入框
function disableFollowupInput() {
    const followupInput = document.querySelector('.ai-buddy-followup-input');
    const followupButton = document.querySelector('.ai-buddy-followup-button');
    
    if (followupInput) {
        followupInput.disabled = true;
        followupInput.placeholder = '生成回答中，请稍候...';
    }
    
    if (followupButton) {
        followupButton.disabled = true;
    }
}

// 启用跟进输入框
function enableFollowupInput() {
    const followupInput = document.querySelector('.ai-buddy-followup-input');
    const followupButton = document.querySelector('.ai-buddy-followup-button');
    
    if (followupInput) {
        followupInput.disabled = false;
        followupInput.placeholder = '可以在这里输入跟进问题...';
    }
    
    if (followupButton) {
        followupButton.disabled = false;
    }
}

// 创建复制按钮的函数
function createCopyButton(actionBar, outputContainer) {
    const copyButton = document.createElement('button');
    copyButton.className = 'ai-buddy-copy-button';
    copyButton.textContent = '复制内容';
    copyButton.onclick = () => {
        // 获取纯文本内容
        const content = outputContainer.innerText || outputContainer.textContent;
        
        // 复制到剪贴板
        navigator.clipboard.writeText(content)
            .then(() => {
                // 复制成功，暂时改变按钮文本
                const originalText = copyButton.textContent;
                copyButton.textContent = '已复制!';
                copyButton.classList.add('copied');
                
                // 2秒后恢复原来的文本
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.classList.remove('copied');
                }, 2000);
            })
            .catch(err => {
                console.error('复制失败:', err);
                copyButton.textContent = '复制失败';
                setTimeout(() => {
                    copyButton.textContent = '复制内容';
                }, 2000);
            });
    };
    
    actionBar.appendChild(copyButton);
    return copyButton;
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

// 添加新的布局样式，确保输入框始终在popup内部
const fixedLayoutStyles = `
  /* 设置弹窗为flex布局 */
  .ai-buddy-response-popup {
    display: flex !important;
    flex-direction: column !important;
    max-height: 70vh !important;
  }

  /* 创建一个主内容区，包含滚动内容和输入框 */
  .ai-buddy-main-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0; /* 确保flex子项可以正确收缩 */
    position: relative;
  }

  /* 内容区域可滚动，但保留底部空间给输入框 */
  .ai-buddy-response-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 12px;
    padding-bottom: 16px; /* 确保内容和输入框之间有空间 */
    max-height: none !important; /* 取消最大高度限制，由弹窗控制 */
  }

  /* 确保输入区域固定在底部 */
  .ai-buddy-followup-container {
    flex-shrink: 0;
    margin-top: 16px;
    border-top: 1px solid #eaeaea;
    padding-top: 16px;
    background-color: white;
    z-index: 2;
    position: sticky;
    bottom: 0;
  }

  /* 操作栏也应该不参与滚动 */
  .ai-buddy-action-bar {
    flex-shrink: 0;
  }
`;

// 将样式添加到文档
const fixedLayoutStyleElement = document.createElement('style');
fixedLayoutStyleElement.textContent = fixedLayoutStyles;
document.head.appendChild(fixedLayoutStyleElement);

// 修改 showResponse 函数，确保弹窗始终居中显示
function showResponse(response, x, y, isStreaming = false, isHtml = false) {
  // 确保样式更新
  updatePopupStyles();
  
  let popup = document.querySelector('.ai-buddy-response-popup');
  let contentContainer = null;
  
  // 忽略传入的x和y坐标，始终使用屏幕中心
  const centerX = window.innerWidth / 2 + window.scrollX;
  const centerY = window.innerHeight / 2 + window.scrollY;
  
  console.log("使用屏幕中心坐标:", centerX, centerY, "而不是:", x, y);
  
  // 如果没有现有弹窗，创建一个新的
  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'ai-buddy-response-popup';
    
    // 设置宽度
    popup.style.width = '600px';
    popup.style.maxWidth = '90vw';
    
    // 创建顶部操作栏
    const actionBar = document.createElement('div');
    actionBar.className = 'ai-buddy-action-bar';
    popup.appendChild(actionBar);
    
    // 创建主容器
    const mainContainer = document.createElement('div');
    mainContainer.className = 'ai-buddy-main-container';
    popup.appendChild(mainContainer);
    
    // 创建内容容器
    contentContainer = document.createElement('div');
    contentContainer.className = 'ai-buddy-response-content';
    mainContainer.appendChild(contentContainer);
    
    // 创建输入区域
    const followupContainer = document.createElement('div');
    followupContainer.className = 'ai-buddy-followup-container';
    
    const followupInput = document.createElement('textarea');
    followupInput.className = 'ai-buddy-followup-input';
    followupInput.rows = 2;
    
    // 检测平台并设置适当的快捷键提示
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const shortcutText = isMac ? "Command+Enter 发送" : "Alt+Enter 发送";
    followupInput.placeholder = `可以在这里输入跟进问题... (${shortcutText})`;
    
    const followupButton = document.createElement('button');
    followupButton.className = 'ai-buddy-followup-button';
    followupButton.textContent = '提问';
    followupButton.title = isMac ? 'Command+Enter快捷发送' : 'Alt+Enter快捷发送';
    
    // 设置按钮点击事件
    followupButton.onclick = () => {
      const question = followupInput.value.trim();
      if (question) {
        // 在内容容器中添加用户问题
        const userQuestionDiv = document.createElement('div');
        userQuestionDiv.className = 'ai-buddy-user-question';
        userQuestionDiv.innerHTML = `<div class="question-header">我的问题：</div><div class="question-content">${question}</div>`;
        contentContainer.appendChild(userQuestionDiv);
        
        // 构建完整提示
        const chatHistory = collectChatHistory();
        const fullPrompt = `${chatHistory}\n\n我的新问题是：${question}`;
        
        // 清空输入框并发送请求
        followupInput.value = '';
        
        // 使用屏幕中心坐标，而不是传递当前弹窗位置
        const centerX = window.innerWidth / 2 + window.scrollX;
        const centerY = window.innerHeight / 2 + window.scrollY;
        sendToLLM(fullPrompt, centerX, centerY, true);
        
        // 自动滚动到问题底部
        contentContainer.scrollTop = contentContainer.scrollHeight;
      }
    };
    
    // 添加键盘提示元素
    const keyboardHint = document.createElement('div');
    keyboardHint.className = 'ai-buddy-keyboard-hint';
    keyboardHint.textContent = `按${isMac ? '⌘+Enter' : 'Alt+Enter'}快速发送 / 按Esc关闭窗口`;
    
    followupContainer.appendChild(followupInput);
    followupContainer.appendChild(followupButton);
    followupContainer.appendChild(keyboardHint);
    
    mainContainer.appendChild(followupContainer);
    
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
    
    // 初始化为屏幕中心坐标
    popup.style.left = `${centerX}px`;
    popup.style.top = `${centerY}px`;
    
    document.body.appendChild(popup);
    
    // 弹窗添加到DOM后立即居中显示
    centerElementOnScreen(popup);
    
    // 添加窗口大小改变时重新居中的监听器
    window.addEventListener('resize', () => {
      if (popup && document.body.contains(popup)) {
        centerElementOnScreen(popup);
      }
    });
  } else {
    // 使用现有弹窗
    contentContainer = popup.querySelector('.ai-buddy-response-content');
    
    // 确保现有弹窗居中
    centerElementOnScreen(popup);
  }
  
  // 如果不是流式输出且有内容，直接渲染全部内容
  if (!isStreaming && response && contentContainer) {
    if (isHtml) {
      // 如果是HTML内容，内容将由调用方设置
    } else {
      // 原来的markdown渲染
      contentContainer.innerHTML = renderMarkdown(response);
    }
  }
  
  return contentContainer; // 返回内容容器，方便流式更新
}

// 同样简化 showApiResponse 函数
function showApiResponse(data, x, y) {
    // 移除所有菜单
    removeAllMenus();
    
    // 使用HTML方式显示响应，这样可以包含交互式JSON渲染
    const responseHtml = formatJsonResponse(data);
    
    // 显示响应，传入false表示不是流式输出，true表示是HTML内容
    const contentContainer = showResponse("", x, y, false, true);
    
    // 在内容容器中设置格式化后的JSON
    if (contentContainer) {
        // 创建一个包含API响应的div
        const apiResponseDiv = document.createElement('div');
        apiResponseDiv.className = 'ai-buddy-api-response';
        apiResponseDiv.innerHTML = responseHtml;
        contentContainer.appendChild(apiResponseDiv);
        
        // 保存原始数据供后续查询使用
        contentContainer.dataset.originalJson = JSON.stringify(data);
        
        // 绑定点击事件，让JSON树中的details元素可以折叠/展开
        const detailsElements = contentContainer.querySelectorAll('details');
        detailsElements.forEach(details => {
            // 已经有原生的折叠/展开功能，只需确保summary可点击
            const summary = details.querySelector('summary');
            if (summary) {
                summary.style.cursor = 'pointer';
            }
        });
        
        // 添加复制按钮
        const actionBar = contentContainer.parentNode.parentNode.querySelector('.ai-buddy-action-bar');
        if (actionBar && !actionBar.querySelector('.ai-buddy-copy-button')) {
            createCopyButton(actionBar, contentContainer);
        }
        
        // 替换跟进问题的处理
        const popup = contentContainer.closest('.ai-buddy-response-popup');
        if (popup) {
            const followupContainer = popup.querySelector('.ai-buddy-followup-container');
            const followupInput = followupContainer?.querySelector('.ai-buddy-followup-input');
            const followupButton = followupContainer?.querySelector('.ai-buddy-followup-button');
            
            if (followupInput && followupButton) {
                // 修改提示文本，根据平台显示不同的快捷键
                followupInput.placeholder = '向LLM询问关于这个API响应的问题...';
                updatePlaceholderText(followupInput);
                
                const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
                followupButton.title = isMac ? 'Command+Enter快捷发送' : 'Alt+Enter快捷发送';
                
                // 替换点击处理器
                followupButton.onclick = () => {
                    const question = followupInput.value.trim();
                    if (question) {
                        // 在内容容器中添加用户问题
                        const userQuestionDiv = document.createElement('div');
                        userQuestionDiv.className = 'ai-buddy-user-question';
                        userQuestionDiv.innerHTML = `<div class="question-header">我的问题：</div><div class="question-content">${question}</div>`;
                        contentContainer.appendChild(userQuestionDiv);
                        
                        // 准备API数据
                        let apiData = '';
                        try {
                            if (contentContainer.dataset.originalJson) {
                                apiData = JSON.stringify(JSON.parse(contentContainer.dataset.originalJson), null, 2);
                            } else {
                                const jsonContent = contentContainer.querySelector('.json-tree');
                                if (jsonContent) {
                                    apiData = jsonContent.textContent;
                                } else {
                                    apiData = apiResponseDiv.textContent;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing API data:', e);
                            apiData = apiResponseDiv.textContent;
                        }
                        
                        // 构建提示
                        const prompt = `以下是一个API返回的JSON数据：\n\n${apiData}\n\n用户问题是：${question}\n\n请分析这些数据并回答用户问题。`;
                        
                        // 清空输入框
                        followupInput.value = '';
                        
                        // 调用LLM，追加到现有弹窗
                        sendToLLM(prompt, x, y, true);
                        
                        // 自动滚动到底部
                        contentContainer.scrollTop = contentContainer.scrollHeight;
                    }
                };
            }
        }
    }
    
    console.log("API响应已显示", typeof data === 'object' ? '(JSON)' : '(Text)');
}

// 修改收集对话历史函数，以适应新的对话流
function collectChatHistory() {
  const contentContainer = document.querySelector('.ai-buddy-response-content');
  if (!contentContainer) return '';
  
  let history = '';
  
  // 按顺序获取所有元素
  const children = Array.from(contentContainer.children);
  let currentQuestion = null;
  
  // 最多保留最近的几轮对话
  const maxHistory = 3; // 最大保留历史轮数
  const relevantItems = children.slice(-maxHistory * 2); // 问题和回答成对，所以是maxHistory的两倍
  
  for (const element of relevantItems) {
    if (element.classList.contains('ai-buddy-user-question')) {
      // 保存问题
      currentQuestion = element.querySelector('.question-content')?.textContent || '';
      if (currentQuestion) {
        history += `用户问题: ${currentQuestion}\n\n`;
      }
    } else if (element.classList.contains('ai-buddy-output-text')) {
      // 添加回答
      history += `AI回答: ${element.textContent}\n\n`;
    } else if (element.classList.contains('ai-buddy-api-response')) {
      // API响应简化处理
      history += `API响应: [JSON数据]\n\n`;
    }
  }
  
  return history;
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

// 修改自定义提示输入函数，使弹窗居中显示
function showCustomPromptInput(x, y) {
    // 保存当前的选中文本，防止后续操作清空它
    const savedSelectedText = selectedTextContent;
    
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
    
    // 初始位置设置为屏幕中心附近 - 将在添加到DOM后调整
    customPromptContainer.style.left = '50%';
    customPromptContainer.style.top = '50%';

    const inputLabel = document.createElement('div');
    inputLabel.className = 'ai-buddy-custom-label';
    inputLabel.textContent = '输入自定义提示:';
    customPromptContainer.appendChild(inputLabel);

    const inputField = document.createElement('textarea');
    inputField.className = 'ai-buddy-custom-input';
    
    // 检测平台并设置适当的快捷键提示
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const shortcutText = isMac ? "Command+Enter 提交" : "Alt+Enter 提交";
    inputField.placeholder = `例如: 请帮我分析这段文字... (${shortcutText})`;
    inputField.rows = 3;
    customPromptContainer.appendChild(inputField);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'ai-buddy-custom-buttons';

    // 创建提交按钮
    const submitButton = document.createElement('button');
    submitButton.className = 'ai-buddy-custom-submit';
    submitButton.textContent = '提交';
    submitButton.title = isMac ? 'Command+Enter快捷提交' : 'Alt+Enter快捷提交';
    
    // 创建提交函数以便重用
    const submitCustomPrompt = function() {
        const customPromptText = inputField.value.trim();
        if (customPromptText) {
            // 移除自定义提示框
            if (customPromptContainer.parentNode) {
                document.body.removeChild(customPromptContainer);
            }
            
            // 使用之前保存的文本，而不是当前的全局变量
            if (!savedSelectedText) {
                showResponse("错误: 找不到选中的文本", x, y);
                return;
            }
            
            // 组合提示文本和选中的内容
            const fullPrompt = customPromptText + " " + savedSelectedText;
            
            // 使用流式输出调用LLM
            sendToLLM(fullPrompt, x, y);
        }
    };
    
    submitButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        submitCustomPrompt();
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

    // 添加键盘事件监听
    inputField.addEventListener('keydown', function(e) {
        // 如果是Alt+Enter或Command+Enter
        if (e.key === 'Enter' && (e.altKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            submitCustomPrompt();
        }
        
        // 如果是Esc键，关闭提示框
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (customPromptContainer.parentNode) {
                document.body.removeChild(customPromptContainer);
            }
        }
    });

    // 添加键盘快捷键提示
    const keyboardHint = document.createElement('div');
    keyboardHint.className = 'ai-buddy-keyboard-hint';
    keyboardHint.textContent = `按${isMac ? '⌘+Enter' : 'Alt+Enter'}快速提交 / 按Esc取消`;
    
    // 可选: 添加一个显示选中文本的区域
    const selectedTextDisplay = document.createElement('div');
    selectedTextDisplay.className = 'ai-buddy-selected-text-display';
    selectedTextDisplay.innerHTML = `<strong>选中文本:</strong> <span class="text-preview">${savedSelectedText.length > 50 ? savedSelectedText.substring(0, 50) + '...' : savedSelectedText}</span>`;
    selectedTextDisplay.style.marginTop = '8px';
    selectedTextDisplay.style.fontSize = '12px';
    selectedTextDisplay.style.color = '#666';
    selectedTextDisplay.style.padding = '4px 8px';
    selectedTextDisplay.style.backgroundColor = '#f9f9f9';
    selectedTextDisplay.style.borderRadius = '4px';
    selectedTextDisplay.style.maxHeight = '60px';
    selectedTextDisplay.style.overflow = 'auto';
    
    customPromptContainer.appendChild(buttonContainer);
    customPromptContainer.appendChild(keyboardHint);
    customPromptContainer.appendChild(selectedTextDisplay);
    
    document.body.appendChild(customPromptContainer);
    
    // 居中显示弹窗
    centerElementOnScreen(customPromptContainer);
    
    // 添加窗口大小改变时重新居中的监听器
    window.addEventListener('resize', () => {
      if (customPromptContainer && document.body.contains(customPromptContainer)) {
        centerElementOnScreen(customPromptContainer);
      }
    });
    
    // 聚焦输入框
    inputField.focus();
}

// 更新自定义提示框的样式，使其与其他界面元素风格一致
const customPromptStyles = `
  .ai-buddy-custom-prompt {
    position: absolute;
    width: 400px;
    max-width: 90vw;
    background-color: white;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
  
  .ai-buddy-custom-label {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
    color: #333;
  }
  
  .ai-buddy-custom-input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    min-height: 60px;
    margin-bottom: 12px;
  }
  
  .ai-buddy-custom-input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }
  
  .ai-buddy-custom-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .ai-buddy-custom-submit, .ai-buddy-custom-cancel {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .ai-buddy-custom-submit {
    background-color: #4a90e2;
    color: white;
  }
  
  .ai-buddy-custom-submit:hover {
    background-color: #3a80d2;
  }
  
  .ai-buddy-custom-cancel {
    background-color: #f2f2f2;
    color: #333;
  }
  
  .ai-buddy-custom-cancel:hover {
    background-color: #e5e5e5;
  }
  
  /* 使自定义提示框内的键盘提示与其他界面一致 */
  .ai-buddy-custom-prompt .ai-buddy-keyboard-hint {
    font-size: 12px;
    color: #666;
    margin: 8px 0;
    text-align: center;
    font-style: italic;
  }
`;

// 添加或更新自定义提示框样式
let customPromptStyleElement = document.getElementById('ai-buddy-custom-prompt-styles');
if (!customPromptStyleElement) {
  customPromptStyleElement = document.createElement('style');
  customPromptStyleElement.id = 'ai-buddy-custom-prompt-styles';
  document.head.appendChild(customPromptStyleElement);
}
customPromptStyleElement.textContent = customPromptStyles;

// 修改 createPromptMenu 函数，确保菜单在视口内
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

    // 初始位置设置
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
        
        // 修改子菜单悬停处理
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
                // 使用屏幕中心坐标
                const centerX = window.innerWidth / 2 + window.scrollX;
                const centerY = window.innerHeight / 2 + window.scrollY;
                showCustomPromptInput(centerX, centerY);
                return;
            }
            
            // 使用屏幕中心坐标
            const centerX = window.innerWidth / 2 + window.scrollX;
            const centerY = window.innerHeight / 2 + window.scrollY;
            
            // 处理 API 调用
            if (option.isApi) {
                // 显示加载指示器
                menuItem.innerHTML = '⏳ ' + option.name;
                menuItem.style.pointerEvents = 'none';
                callExternalApi(option, selectedTextContent, centerX, centerY);
                return;
            }
            
            // 显示加载指示器
            menuItem.innerHTML = '⏳ ' + option.name;
            menuItem.style.pointerEvents = 'none';
            
            // 检查是否需要使用网站特定的系统提示
            let fullPrompt = option.prompt + " " + selectedTextContent;
            
            if (option.systemPrompt === true) {
                // 获取当前域名
                const currentDomain = getCurrentDomain();
                // 获取该域名对应的系统提示
                const systemPrompt = getSystemPromptForDomain(currentDomain);
                
                // 组合系统提示、菜单提示和选中文本
                fullPrompt = `${systemPrompt}\n\n${option.prompt} ${selectedTextContent}`;
                console.log(`使用网站特定提示: ${currentDomain} -> ${systemPrompt.substring(0, 50)}...`);
            }
            
            // 发送请求
            sendToLLM(fullPrompt, centerX, centerY);
        });
        
        menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // 添加后调整位置，确保在视口内
    adjustElementPosition(menu, x, y);
    
    if (isSubmenu) {
        menu.dataset.isSubmenu = 'true';
    } else {
        promptMenu = menu;
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

// 增强 removeAllPopups 函数，作为 Esc 键的响应函数
function removeAllPopups() {
    console.log("执行 removeAllPopups");
    
    // 移除所有浮动按钮
    const floatingButtons = document.querySelectorAll('.ai-buddy-floating-button');
    floatingButtons.forEach(button => {
        if (button.parentNode) {
            console.log("移除浮动按钮");
            button.parentNode.removeChild(button);
        }
    });
    
    // 移除所有菜单
    const menus = document.querySelectorAll('.ai-buddy-prompt-menu, .ai-buddy-main-menu, .ai-buddy-submenu');
    menus.forEach(menu => {
        if (menu.parentNode) {
            console.log("移除菜单");
            menu.parentNode.removeChild(menu);
        }
    });
    
    // 移除所有响应弹窗
    const popups = document.querySelectorAll('.ai-buddy-response-popup');
    popups.forEach(popup => {
        if (popup.parentNode) {
            console.log("移除弹窗");
            popup.parentNode.removeChild(popup);
        }
    });
    
    // 移除自定义提示框
    const customPrompts = document.querySelectorAll('.ai-buddy-custom-prompt');
    customPrompts.forEach(prompt => {
        if (prompt.parentNode) {
            console.log("移除自定义提示框");
            prompt.parentNode.removeChild(prompt);
        }
    });
    
    // 移除任何加载指示器或临时消息
    const loaders = document.querySelectorAll('.ai-buddy-loader, .ai-buddy-temp-message');
    loaders.forEach(loader => {
        if (loader.parentNode) {
            console.log("移除加载指示器");
            loader.parentNode.removeChild(loader);
        }
    });
    
    // 重置全局变量
    floatingButton = null;
    promptMenu = null;
    
    console.log("所有元素已清理完毕");
}

// 添加一个直接的调试函数，用于测试键盘快捷键
function setupGlobalKeyboardListeners() {
    document.addEventListener('keydown', function(e) {
        // 记录所有键盘事件以帮助调试
        console.log(`键盘事件: key=${e.key}, code=${e.code}, altKey=${e.altKey}, ctrlKey=${e.ctrlKey}, metaKey=${e.metaKey}`);
        
        // 当按下 Esc 键时
        if (e.key === 'Escape') {
            console.log("执行全局 Escape 键功能 - 关闭所有元素");
            removeAllPopups();
        }
        
        // 添加一个测试组合键，用于调试
        if (e.key === 'D' && e.altKey) {
            console.log("执行 Alt+D 测试功能");
            alert('键盘快捷键系统正常工作中');
        }
    });
    
    console.log("全局键盘监听器已设置");
}

// 初始化时设置全局键盘监听
setupGlobalKeyboardListeners();

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

// 修改 showMenu 函数以考虑页面滚动
function showMenu(x, y, parentOption = null) {
    if (promptMenu) {
        document.body.removeChild(promptMenu);
        promptMenu = null;
    }
    
    promptMenu = document.createElement('div');
    promptMenu.className = 'ai-buddy-prompt-menu';
    
    // 确保使用的是已经包含滚动的坐标
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
        
        // 修改子菜单悬停处理，确保正确考虑滚动位置
        if (option.subMenu) {
            item.addEventListener('mouseenter', function(e) {
                const rect = item.getBoundingClientRect();
                // 确保添加滚动位置
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
    
    // 添加调整位置
    adjustElementPosition(promptMenu, x, y);
}

// 更新API调用函数，确保GET和POST请求使用相同的JSON渲染
function callExternalApi(apiOption, text, x, y) {
    console.log("Making API call with text:", text);
    
    // 显示加载提示
    showResponse("正在处理...", x, y);
    
    let url = apiOption.apiUrl;
    let params = { ...apiOption.params };
    
    // 如果指定了特定的参数名，将选中文字放入该参数
    if (apiOption.paramName) {
        params[apiOption.paramName] = text;
    } else {
        // 默认将文字放入text参数
        params.text = text;
    }
    
    console.log("Request params:", params);
    
    try {
        // 处理 GET 请求
        if (apiOption.method === 'GET') {
            const queryString = Object.keys(params)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
                .join('&');
            url = `${url}?${queryString}`;
            
            console.log("GET request to:", url);
            
            fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': '*/*'
                }
            })
            .then(response => {
                console.log("Response status:", response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // 检查内容类型
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return response.json().then(data => {
                        // 使用折叠JSON视图显示JSON数据
                        showApiResponse(data, x, y);
                    });
                } else {
                    // 对于非JSON响应，以文本形式显示
                    return response.text().then(text => {
                        // 尝试判断是否可能是JSON格式的文本
                        try {
                            const jsonData = JSON.parse(text);
                            showApiResponse(jsonData, x, y);
                        } catch (e) {
                            // 不是JSON，直接显示文本
                            showResponse(text, x, y);
                        }
                    });
                }
            })
            .catch(error => {
                console.error("API error:", error);
                showResponse("API 调用失败: " + error.message, x, y);
            });
        } else {
            // POST 请求，保持现有逻辑，但确保使用相同的渲染方式
            console.log("POST request to:", url, "with body:", JSON.stringify(params));
            
            fetch(url, {
                method: apiOption.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*'
                },
                body: JSON.stringify(params)
            })
            .then(response => {
                console.log("Response status:", response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // 检查内容类型
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return response.json().then(data => {
                        // 使用折叠JSON视图显示JSON数据
                        showApiResponse(data, x, y);
                    });
                } else {
                    // 对于非JSON响应，以文本形式显示
                    return response.text().then(text => {
                        // 尝试判断是否可能是JSON格式的文本
                        try {
                            const jsonData = JSON.parse(text);
                            showApiResponse(jsonData, x, y);
                        } catch (e) {
                            // 不是JSON，直接显示文本
                            showResponse(text, x, y);
                        }
                    });
                }
            })
            .catch(error => {
                console.error("API error:", error);
                showResponse("API 调用失败: " + error.message, x, y);
            });
        }
    } catch (error) {
        console.error("Error in API call setup:", error);
        showResponse("API 调用设置错误: " + error.message, x, y);
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

// 添加终止按钮样式
const stopButtonStyles = `
    .ai-buddy-stop-button {
        background-color: #ff4444;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 13px;
        cursor: pointer;
        transition: background-color 0.2s;
        margin-left: auto;
    }
    
    .ai-buddy-stop-button:hover {
        background-color: #ff2222;
    }
    
    .ai-buddy-stop-button:disabled {
        cursor: default;
        opacity: 0.6;
    }
    
    .ai-buddy-stop-button.stopped {
        background-color: #666;
    }
    
    .ai-buddy-stop-button.completed {
        background-color: #22aa22;
    }
    
    .ai-buddy-action-bar {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        gap: 8px;
    }
`;

// 将终止按钮样式添加到文档中
const stopButtonStyleElement = document.createElement('style');
stopButtonStyleElement.textContent = stopButtonStyles;
document.head.appendChild(stopButtonStyleElement);

// 添加跟进提问输入框的样式
const followupStyles = `
  .ai-buddy-followup-container {
    margin-top: 16px;
    border-top: 1px solid #eaeaea;
    padding-top: 16px;
    display: flex;
    gap: 8px;
  }
  
  .ai-buddy-followup-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    resize: none;
  }
  
  .ai-buddy-followup-input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }
  
  .ai-buddy-followup-button {
    padding: 8px 16px;
    background-color: #4a90e2;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    align-self: flex-end;
  }
  
  .ai-buddy-followup-button:hover {
    background-color: #3a80d2;
  }
`;

// 添加跟进提问样式到文档中
const followupStyleElement = document.createElement('style');
followupStyleElement.textContent = followupStyles;
document.head.appendChild(followupStyleElement);

// 添加对话样式
const conversationStyles = `
  .ai-buddy-conversation-separator {
    margin: 16px 0;
    position: relative;
    text-align: center;
  }
  
  .ai-buddy-conversation-separator hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 0;
  }
  
  .ai-buddy-conversation-separator .separator-text {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background-color: white;
    padding: 0 12px;
    font-size: 12px;
    color: #777;
  }
  
  .ai-buddy-user-question {
    margin: 12px 0;
    padding: 8px 12px;
    background-color: #f5f8ff;
    border-left: 3px solid #4a90e2;
    border-radius: 4px;
  }
  
  .ai-buddy-user-question .question-header {
    font-weight: bold;
    font-size: 13px;
    margin-bottom: 4px;
    color: #4a6fa5;
  }
  
  .ai-buddy-user-question .question-content {
    font-size: 14px;
  }
  
  .ai-buddy-followup-input:disabled {
    background-color: #f5f5f5;
    color: #999;
  }
  
  .ai-buddy-followup-button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

// 添加对话样式到文档中
const conversationStyleElement = document.createElement('style');
conversationStyleElement.textContent = conversationStyles;
document.head.appendChild(conversationStyleElement);

// 添加API响应的样式
const apiResponseStyles = `
  .ai-buddy-api-response {
    padding: 12px;
    background-color: #f9fcff;
    border: 1px solid #e5eef7;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  
  /* 为了区分API响应和LLM回答，给LLM回答添加一些样式 */
  .ai-buddy-output-text {
    padding: 12px;
    background-color: #f8fff9;
    border: 1px solid #e6f5e8;
    border-radius: 6px;
    margin-bottom: 16px;
  }
`;

// 添加API响应样式到文档中
const apiResponseStyleElement = document.createElement('style');
apiResponseStyleElement.textContent = apiResponseStyles;
document.head.appendChild(apiResponseStyleElement);

// 添加一个通用函数来调整元素位置，确保在视口内
function adjustElementPosition(element, startX, startY, margin = 20) {
  // 获取元素尺寸
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // 计算最佳位置
  let bestX = startX;
  let bestY = startY;
  
  // 处理右侧边界
  if (startX + rect.width > window.scrollX + viewportWidth) {
    bestX = window.scrollX + viewportWidth - rect.width - margin;
  }
  
  // 处理底部边界
  if (startY + rect.height > window.scrollY + viewportHeight) {
    bestY = window.scrollY + viewportHeight - rect.height - margin;
  }
  
  // 处理左侧边界
  if (bestX < window.scrollX) {
    bestX = window.scrollX + margin;
  }
  
  // 处理顶部边界
  if (bestY < window.scrollY) {
    bestY = window.scrollY + margin;
  }
  
  // 应用计算的位置
  element.style.left = `${bestX}px`;
  element.style.top = `${bestY}px`;
  
  return { x: bestX, y: bestY };
} 

// 优化浮动按钮位置计算函数
function calculateButtonPosition(selection) {
  // 默认位置 (视口中心)
  let defaultPosition = {
    x: window.innerWidth / 2 + window.scrollX,
    y: window.innerHeight / 2 + window.scrollY
  };
  
  try {
    // 尝试获取选择区域的位置
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // 如果选择区域宽度为0（例如光标位置），尝试获取父元素位置
      if (rect.width === 0 && range.startContainer.parentElement) {
        const parentRect = range.startContainer.parentElement.getBoundingClientRect();
        return {
          x: parentRect.right + window.scrollX + 10,
          y: parentRect.top + window.scrollY - 10
        };
      }
      
      // 使用选择区域的右上角
      return {
        x: rect.right + window.scrollX + 10,
        y: rect.top + window.scrollY - 10
      };
    }
    
    // 如果有活动元素，使用活动元素的位置
    if (document.activeElement && document.activeElement !== document.body) {
      const activeRect = document.activeElement.getBoundingClientRect();
      return {
        x: activeRect.right + window.scrollX + 10,
        y: activeRect.top + window.scrollY - 10
      };
    }
  } catch (e) {
    console.error("计算按钮位置时出错:", e);
  }
  
  // 使用默认位置
  return defaultPosition;
}

// 添加键盘提示样式
const keyboardTipStyles = `
  .ai-buddy-keyboard-tip {
    font-size: 12px;
    color: #777;
    margin-top: 6px;
    text-align: right;
    font-style: italic;
  }
  
  /* 给按钮添加提示样式 */
  .ai-buddy-followup-button {
    position: relative;
  }
  
  .ai-buddy-followup-button:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: #333;
    color: white;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    margin-bottom: 5px;
    z-index: 100;
  }
`;

// 添加键盘提示样式到文档
const keyboardTipStyleElement = document.createElement('style');
keyboardTipStyleElement.textContent = keyboardTipStyles;
document.head.appendChild(keyboardTipStyleElement);

// 添加全局 Esc 键监听，关闭所有菜单和弹窗
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    console.log("Esc 键按下，关闭所有元素");
    removeAllPopups(); // 使用已有的清理函数
  }
});

// 添加更可靠的快捷键绑定函数
function attachAltEnterShortcut(inputElement, callback) {
    if (!inputElement || !callback) return;
    
    // 确保使用内联函数，而不是箭头函数，这样能够正确访问 this
    const keyHandler = function(event) {
        console.log("输入框键盘事件:", event.key, "Alt:", event.altKey, "元素:", this);
        
        if (event.key === 'Enter' && event.altKey) {
            console.log("Alt+Enter 快捷键捕获成功");
            event.preventDefault();
            event.stopPropagation();
            callback();
            return false;
        }
    };
    
    // 移除任何现有处理器
    if (inputElement._altEnterHandler) {
        inputElement.removeEventListener('keydown', inputElement._altEnterHandler);
    }
    
    // 添加新处理器并存储引用
    inputElement.addEventListener('keydown', keyHandler);
    inputElement._altEnterHandler = keyHandler;
    
    // 添加可见提示
    inputElement.setAttribute('placeholder', inputElement.getAttribute('placeholder') || '' + ' (Alt+Enter发送)');
    console.log("Alt+Enter 快捷键绑定成功到:", inputElement);
}

// 在文档根级别捕获键盘事件，直接处理Esc和提交快捷键
document.addEventListener('keydown', function(event) {
  // 处理Esc键 - 关闭所有弹窗和菜单
  if (event.key === 'Escape') {
    console.log('Esc键按下 - 关闭所有界面元素');
    removeAllPopups();
    return;
  }
  
  // 处理Alt+Enter提交 - 查找当前活动的输入框并提交
  if (event.key === 'Enter' && event.altKey) {
    console.log('Alt+Enter键按下 - 尝试提交问题');
    
    // 检查当前是否有可见的AI Buddy弹窗
    const popup = document.querySelector('.ai-buddy-response-popup');
    if (popup) {
      // 查找输入框和按钮
      const followupInput = popup.querySelector('.ai-buddy-followup-input');
      const followupButton = popup.querySelector('.ai-buddy-followup-button');
      
      if (followupInput && followupButton && !followupInput.disabled) {
        console.log('找到活动的输入框，提交问题');
        event.preventDefault(); // 阻止默认行为
        
        // 直接触发按钮点击事件
        followupButton.click();
        return;
      }
    }
  }
});

// 优化全局键盘监听器，加入调试日志
function initGlobalKeyboardListeners() {
  console.log('初始化全局键盘监听器');
  
  // 确保我们没有重复添加监听器
  document.removeEventListener('keydown', globalKeyHandler);
  document.addEventListener('keydown', globalKeyHandler);
  
  console.log('全局键盘监听器已启动');
}

// 全局键盘事件处理函数，同时支持Alt+Enter和Command+Enter
function globalKeyHandler(event) {
  console.log(`键盘事件: key=${event.key}, altKey=${event.altKey}, metaKey=${event.metaKey}, target=${event.target.tagName}`);
  
  // 处理Esc键
  if (event.key === 'Escape') {
    console.log('Esc键处理 - 关闭所有界面元素');
    removeAllPopups();
    return;
  }
  
  // 处理Alt+Enter或Command+Enter
  if (event.key === 'Enter' && (event.altKey || event.metaKey)) {
    console.log('快捷键发送处理 - ' + (event.altKey ? 'Alt+Enter' : 'Command+Enter'));
    
    // 查找当前活动的弹窗
    const popup = document.querySelector('.ai-buddy-response-popup');
    if (!popup) {
      console.log('未找到活动弹窗');
      return;
    }
    
    // 查找输入框和按钮
    const input = popup.querySelector('.ai-buddy-followup-input');
    const button = popup.querySelector('.ai-buddy-followup-button');
    
    if (input && button && !input.disabled) {
      console.log('找到活动输入框，点击按钮');
      event.preventDefault();
      button.click();
    } else {
      console.log('未找到活动输入框或按钮已禁用');
    }
  }
}

// 增强 removeAllPopups 函数
function removeAllPopups() {
  console.log('执行 removeAllPopups');
  
  // 移除所有浮动按钮
  document.querySelectorAll('.ai-buddy-floating-button').forEach(el => el.parentNode?.removeChild(el));
  
  // 移除所有菜单
  document.querySelectorAll('.ai-buddy-prompt-menu, .ai-buddy-submenu').forEach(el => el.parentNode?.removeChild(el));
  
  // 移除所有响应弹窗
  document.querySelectorAll('.ai-buddy-response-popup').forEach(el => el.parentNode?.removeChild(el));
  
  // 移除自定义提示框
  document.querySelectorAll('.ai-buddy-custom-prompt').forEach(el => el.parentNode?.removeChild(el));
  
  // 重置全局变量
  floatingButton = null;
  promptMenu = null;
  
  console.log('所有界面元素已清理');
}

// 添加键盘提示样式
const keyboardHintStyles = `
  .ai-buddy-keyboard-hint {
    font-size: 12px;
    color: #666;
    margin-top: 8px;
    text-align: center;
    font-style: italic;
  }
`;

// 添加键盘提示样式到文档
const keyboardHintStyleElement = document.createElement('style');
keyboardHintStyleElement.textContent = keyboardHintStyles;
document.head.appendChild(keyboardHintStyleElement);

// 初始化键盘监听器
initGlobalKeyboardListeners();

// 更新提示文本，显示两种快捷键方式
function updatePlaceholderText(inputElement) {
  if (!inputElement) return;
  
  // 根据用户平台选择合适的提示文本
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutText = isMac 
    ? "Command+Enter 发送" 
    : "Alt+Enter 发送";
  
  // 确保不重复添加快捷键提示
  let placeholder = inputElement.placeholder || "";
  if (!placeholder.includes("Enter")) {
    inputElement.placeholder = `${placeholder} (${shortcutText})`;
  }
}

// 更新视觉提示，显示用户平台相应的快捷键
function createKeyboardHintElement() {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const sendShortcut = isMac ? "⌘+Enter" : "Alt+Enter";
  
  const keyboardHint = document.createElement('div');
  keyboardHint.className = 'ai-buddy-keyboard-hint';
  keyboardHint.textContent = `按${sendShortcut}快速发送 / 按Esc关闭窗口`;
  
  return keyboardHint;
}

// 添加一个通用函数，用于将元素居中显示在屏幕上
function centerElementOnScreen(element) {
  if (!element) return;
  
  // 获取视口尺寸
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // 获取元素尺寸
  const rect = element.getBoundingClientRect();
  const elementWidth = rect.width;
  const elementHeight = rect.height;
  
  // 计算居中位置（考虑滚动位置）
  const centerX = window.scrollX + (viewportWidth - elementWidth) / 2;
  const centerY = window.scrollY + (viewportHeight - elementHeight) / 2;
  
  // 应用位置
  element.style.left = `${Math.max(0, centerX)}px`;
  element.style.top = `${Math.max(0, centerY)}px`;
  
  console.log(`元素已居中: width=${elementWidth}, height=${elementHeight}, position=(${centerX}, ${centerY})`);
}

// 添加居中弹窗的样式
function addCenteredPopupStyles() {
    const styles = `
        /* 确保弹窗居中时的平滑过渡 */
        .ai-buddy-response-popup, .ai-buddy-custom-prompt {
            transition: left 0.2s ease-out, top 0.2s ease-out;
        }
        
        /* 修复弹窗中的内容在切换中可能出现的闪烁 */
        .ai-buddy-response-popup {
            will-change: transform;
            transform: translateZ(0);
        }
        
        /* 鼠标悬停时增加视觉反馈 */
        .ai-buddy-response-popup:hover, .ai-buddy-custom-prompt:hover {
            box-shadow: 0 12px 40px rgba(0,0,0,0.25) !important;
        }
    `;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'ai-buddy-centered-popup-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    
    console.log("居中弹窗样式已添加");
}

// 在初始化时添加样式
addCenteredPopupStyles();

// 添加获取当前域名的函数
function getCurrentDomain() {
  const domain = window.location.hostname;
  return domain;
}

// 根据当前域名获取系统提示
function getSystemPromptForDomain(domain) {
  if (!domainPrompts) return "";
  
  // 移除可能的 www. 前缀
  const cleanDomain = domain.replace(/^www\./, '');
  
  // 尝试精确匹配
  if (domainPrompts[cleanDomain]) {
    console.log(`找到网站 ${cleanDomain} 的特定提示`);
    return domainPrompts[cleanDomain];
  }
  
  // 尝试部分匹配（例如 example.github.io 应该匹配 github.io）
  for (const key in domainPrompts) {
    if (cleanDomain.endsWith(key) || cleanDomain.includes(key)) {
      console.log(`找到部分匹配网站 ${key} 的提示`);
      return domainPrompts[key];
    }
  }
  
  // 找不到特定配置时使用默认提示
  console.log(`未找到特定提示，使用默认提示`);
  return domainPrompts["default"] || "";
}