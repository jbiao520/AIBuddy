let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";

// Define different prompt options
const promptOptions = [
  { 
    name: "解释内容", 
    prompt: "请解释以下内容："
  },
  { 
    name: "总结内容", 
    prompt: "请总结以下内容："
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
                    sendPromptToLLM(option.prompt + " " + selectedTextContent, x, y);
                }
            });
        }
        
        promptMenu.appendChild(item);
    });
    
    document.body.appendChild(promptMenu);
}

// API 调用函数
function callExternalApi(apiOption, text, x, y) {
    console.log("Making API call with text:", text);
    
    // 显示加载提示
    showResponsePopup("正在处理...", x, y);
    
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
                showResponsePopup(formattedResponse, x, y);
            } else {
                showResponsePopup(data, x, y);
            }
        })
        .catch(error => {
            console.error("API error:", error);
            showResponsePopup("API调用失败: " + error.message, x, y);
        })
        .finally(() => removeFloatingElements());
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
            
            // 格式化并显示JSON响应
            const formattedResponse = formatJsonResponse(data);
            showResponsePopup(formattedResponse, x, y);
        })
        .catch(error => {
            console.error("API error:", error);
            showResponsePopup("API调用失败: " + error.message, x, y);
        })
        .finally(() => removeFloatingElements());
    }
}

// 格式化JSON响应
function formatJsonResponse(data) {
    try {
        return JSON.stringify(data, null, 2);
    } catch (e) {
        return "无法解析响应数据: " + e.message;
    }
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

// 添加相关的 CSS 样式
const additionalStyles = `
    .menu-arrow {
        float: right;
        margin-left: 8px;
        font-size: 10px;
        color: #666;
    }
    
    .ai-buddy-menu-item:hover {
        background-color: #f0f0f0;
    }
    
    .ai-buddy-menu-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        transition: background-color 0.2s;
        white-space: nowrap;
    }
`;

// 将新样式添加到现有样式中
style.textContent += additionalStyles; 