let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";

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
        name: "Get查询",
        isApi: true,
        apiUrl: "http://localhost:7070/api/service1/users",
        method: "GET",
        params: {
            name: "query"  
        },
        paramName: "name"
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

// 修改发送到LLM的函数，确保关闭所有菜单
function sendToLLM(prompt, x, y, appendToExisting = false) {
    // 关闭所有菜单
    removeAllMenus();
    
    // 创建 AbortController 实例
    const controller = new AbortController();
    const signal = controller.signal;
    
    let existingPopup = null;
    let contentContainer = null;
    
    // 检查是否需要在现有弹窗中追加内容
    if (appendToExisting) {
        existingPopup = document.querySelector('.ai-buddy-response-popup');
        if (existingPopup) {
            contentContainer = existingPopup.querySelector('.ai-buddy-response-content');
            
            // 创建对话分隔线
            const separator = document.createElement('div');
            separator.className = 'ai-buddy-conversation-separator';
            separator.innerHTML = '<hr><div class="separator-text">新的回答</div>';
            contentContainer.appendChild(separator);
        }
    }
    
    // 如果没有现有的弹窗或内容容器，创建一个新的
    if (!existingPopup || !contentContainer) {
        // 立即显示一个空的响应弹窗
        showResponse("", x, y, true);
        contentContainer = document.querySelector('.ai-buddy-response-content');
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
    
    // 创建操作栏并添加按钮
    const actionBar = document.querySelector('.ai-buddy-action-bar');
    
    // 添加终止按钮
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
        if (!actionBar.querySelector('.ai-buddy-copy-button')) {
            createCopyButton(actionBar, outputContainer);
        }
        
        // 启用跟进输入框
        enableFollowupInput();
    };
    
    if (actionBar) {
        // 清除之前的终止按钮
        const oldStopButtons = actionBar.querySelectorAll('.ai-buddy-stop-button');
        oldStopButtons.forEach(btn => {
            if (!btn.disabled) {
                btn.textContent = '已取消';
                btn.disabled = true;
                btn.classList.add('stopped');
            }
        });
        
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
                    // 流结束，移除光标和禁用终止按钮
                    if (cursorContainer.parentNode) {
                        cursorContainer.parentNode.removeChild(cursorContainer);
                    }
                    stopButton.textContent = '已完成';
                    stopButton.disabled = true;
                    stopButton.classList.add('completed');
                    
                    // 添加复制按钮
                    if (!actionBar.querySelector('.ai-buddy-copy-button')) {
                        createCopyButton(actionBar, contentContainer);
                    }
                    
                    // 启用跟进输入框
                    enableFollowupInput();
                    
                    // 如果是新弹窗，自动聚焦到跟进输入框
                    if (!appendToExisting) {
                        const followupInput = document.querySelector('.ai-buddy-followup-input');
                        if (followupInput) {
                            followupInput.focus();
                        }
                    }
                    
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
            stopButton.style.display = 'none';
        }
        
        // 移除光标
        if (cursorContainer.parentNode) {
            cursorContainer.parentNode.removeChild(cursorContainer);
        }
        
        // 错误情况下也显示复制按钮
        if (!actionBar.querySelector('.ai-buddy-copy-button') && outputContainer.textContent.trim()) {
            createCopyButton(actionBar, contentContainer);
        }
        
        // 启用跟进输入框
        enableFollowupInput();
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

  // 添加二次提问输入框和按钮
  const followupContainer = document.createElement('div');
  followupContainer.className = 'ai-buddy-followup-container';
  
  const followupInput = document.createElement('textarea');
  followupInput.className = 'ai-buddy-followup-input';
  followupInput.placeholder = '可以在这里输入跟进问题...';
  followupInput.rows = 2;
  
  const followupButton = document.createElement('button');
  followupButton.className = 'ai-buddy-followup-button';
  followupButton.textContent = '提问';
  followupButton.onclick = () => {
    const question = followupInput.value.trim();
    if (question) {
      // 在跟进容器上方插入用户问题
      const userQuestionDiv = document.createElement('div');
      userQuestionDiv.className = 'ai-buddy-user-question';
      userQuestionDiv.innerHTML = `<div class="question-header">我的问题：</div><div class="question-content">${question}</div>`;
      followupContainer.parentNode.insertBefore(userQuestionDiv, followupContainer);
      
      // 构建完整提示，将部分历史包含在内
      // 注意：如果历史太长，可能需要截断
      const chatHistory = collectChatHistory();
      const fullPrompt = `${chatHistory}\n\n我的新问题是：${question}`;
      
      // 调用LLM，指示追加到现有弹窗
      followupInput.value = ''; // 清空输入框
      sendToLLM(fullPrompt, x, y, true);
    }
  };
  
  // 添加按回车键发送功能
  followupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      followupButton.click();
    }
  });
  
  followupContainer.appendChild(followupInput);
  followupContainer.appendChild(followupButton);
  
  popup.appendChild(followupContainer);
  
  // 定位弹窗，考虑滚动位置
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  popup.style.left = `${Math.min(x, window.scrollX + viewportWidth - 500)}px`;
  popup.style.top = `${Math.min(y, window.scrollY + viewportHeight - 400)}px`;
  
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

// 收集对话历史
function collectChatHistory() {
  const contentContainer = document.querySelector('.ai-buddy-response-content');
  if (!contentContainer) return '';
  
  let history = '';
  
  // 获取所有回答和问题
  const answers = contentContainer.querySelectorAll('.ai-buddy-output-text');
  const questions = contentContainer.querySelectorAll('.ai-buddy-user-question');
  
  // 如果内容太多，只获取最近的几轮对话
  const maxHistory = 2; // 最多保留最近的几轮对话
  const startIdx = Math.max(0, answers.length - maxHistory);
  
  // 拼接历史对话
  for (let i = startIdx; i < answers.length; i++) {
    const questionIndex = i - 1;
    if (questionIndex >= 0 && questions[questionIndex]) {
      history += `用户问题: ${questions[questionIndex].querySelector('.question-content').textContent}\n\n`;
    }
    history += `AI回答: ${answers[i].textContent}\n\n`;
  }
  
  // 如果有最新的问题但还没有回答
  if (questions.length > answers.length - 1) {
    const lastQuestion = questions[questions.length - 1];
    history += `用户问题: ${lastQuestion.querySelector('.question-content').textContent}\n\n`;
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

// Show custom prompt input
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
    
    // 这里 x 和 y 应该已经包含了滚动位置
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
            // 移除自定义提示框
            if (customPromptContainer.parentNode) {
                document.body.removeChild(customPromptContainer);
            }
            
            // 使用之前保存的文本，而不是当前的全局变量
            if (!savedSelectedText) {
                showResponse("错误: 找不到选中的文本", x, y);
                return;
            }
            
            console.log("发送到LLM的文本:", savedSelectedText);
            console.log("发送到LLM的提示:", customPromptText);
            
            // 组合提示文本和选中的内容
            const fullPrompt = customPromptText + " " + savedSelectedText;
            
            // 使用流式输出调用LLM
            sendToLLM(fullPrompt, x, y);
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
    customPromptContainer.appendChild(selectedTextDisplay);  // 添加选中文本显示
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

    // 确保位置考虑了页面滚动
    // 注意：在调用此函数时已经传入了包含滚动的位置，所以不需要再加 window.scrollX/Y
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
        
        // 修改子菜单悬停处理，确保正确考虑滚动位置
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
    adjustMenuPosition(promptMenu);
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

// 修改显示API响应的函数，确保跟进提问能正确发送到LLM
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
        const actionBar = contentContainer.parentNode.querySelector('.ai-buddy-action-bar');
        if (actionBar && !actionBar.querySelector('.ai-buddy-copy-button')) {
            createCopyButton(actionBar, contentContainer);
        }
        
        // 获取跟进输入框和提交按钮
        const followupContainer = contentContainer.parentNode.querySelector('.ai-buddy-followup-container');
        if (followupContainer) {
            const followupInput = followupContainer.querySelector('.ai-buddy-followup-input');
            const followupButton = followupContainer.querySelector('.ai-buddy-followup-button');
            
            if (followupInput && followupButton) {
                // 修改提示文本
                followupInput.placeholder = '向LLM询问关于这个API响应的问题...';
                
                // 保存原有的点击处理器
                const originalClickHandler = followupButton.onclick;
                
                // 替换点击处理器
                followupButton.onclick = () => {
                    const question = followupInput.value.trim();
                    if (question) {
                        // 在跟进容器上方插入用户问题
                        const userQuestionDiv = document.createElement('div');
                        userQuestionDiv.className = 'ai-buddy-user-question';
                        userQuestionDiv.innerHTML = `<div class="question-header">我的问题：</div><div class="question-content">${question}</div>`;
                        followupContainer.parentNode.insertBefore(userQuestionDiv, followupContainer);
                        
                        // 准备向LLM发送的提示
                        let apiData = '';
                        try {
                            // 尝试获取保存的原始JSON
                            if (contentContainer.dataset.originalJson) {
                                apiData = JSON.stringify(JSON.parse(contentContainer.dataset.originalJson), null, 2);
                            } else {
                                // 如果没有保存的原始数据，尝试从显示内容中提取
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
                    }
                };
                
                // 更新回车键处理
                followupInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        followupButton.click();
                    }
                });
            }
        }
    }
    
    console.log("API响应已显示", typeof data === 'object' ? '(JSON)' : '(Text)');
}

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