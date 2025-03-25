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
                showResponse(response, x, y);
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
                } else {
                    // Try to convert entire response object to string
                    try {
                        responseText = "Raw response: " + JSON.stringify(response);
                    } catch (e) {
                        responseText = "Received response in unknown format";
                    }
                }
                
                showResponse(responseText, x, y);
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

// 修改showResponse函数，确保清理其他元素
function showResponse(response, x, y) {
    // 首先移除所有其他弹窗和加载指示器
    const existingPopups = document.querySelectorAll('.ai-buddy-response-popup, .ai-buddy-loader, .ai-buddy-temp-message');
    existingPopups.forEach(popup => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    });
    
    const popup = document.createElement('div');
    popup.className = 'ai-buddy-response-popup';
    
    // 创建内容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'ai-buddy-response-content';
    
    // 渲染Markdown内容
    contentContainer.innerHTML = renderMarkdown(response);
    
    popup.appendChild(contentContainer);
    
    // 定位弹窗，考虑屏幕边缘
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    popup.style.left = `${Math.min(x, viewportWidth - 500)}px`;
    popup.style.top = `${Math.min(y, viewportHeight - 400)}px`;
    
    // 添加关闭按钮
    const closeButton = document.createElement('button');
    closeButton.className = 'ai-buddy-close-button';
    closeButton.textContent = '×';
    closeButton.onclick = () => {
        // 移除弹窗
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
        // 同时清理所有其他UI元素
        removeAllPopups();
    };
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
            
            // 格式化并显示JSON响应
            const formattedResponse = formatJsonResponse(data);
            showResponse(formattedResponse, x, y);
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

// 更新样式，使弹窗更宽并优化Markdown样式
const improvedStyles = `
    .ai-buddy-response-popup {
        position: absolute;
        width: 480px;  /* 更宽的弹窗 */
        max-width: 90vw; /* 响应式设计 */
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
        max-height: calc(70vh - 50px);
        overflow-y: auto;
        padding-right: 12px;
    }
    
    /* 标题样式 */
    .ai-buddy-response-content h1 {
        font-size: 1.4em;
        margin-top: 16px;
        margin-bottom: 12px;
        color: #111;
        border-bottom: 1px solid #eee;
        padding-bottom: 6px;
    }
    
    .ai-buddy-response-content h2 {
        font-size: 1.3em;
        margin-top: 14px;
        margin-bottom: 10px;
        color: #222;
    }
    
    .ai-buddy-response-content h3 {
        font-size: 1.2em;
        margin-top: 12px;
        margin-bottom: 8px;
        color: #333;
    }
    
    /* 段落样式 */
    .ai-buddy-response-content p {
        margin-bottom: 12px;
        line-height: 1.6;
    }
    
    /* 加粗与斜体 */
    .ai-buddy-response-content strong {
        font-weight: 600;
        color: #000;
    }
    
    .ai-buddy-response-content em {
        font-style: italic;
    }
    
    /* 列表样式 */
    .ai-buddy-response-content ul, 
    .ai-buddy-response-content ol {
        padding-left: 24px;
        margin-bottom: 14px;
        margin-top: 8px;
    }
    
    .ai-buddy-response-content li {
        margin-bottom: 6px;
    }
    
    /* 代码样式 */
    .ai-buddy-response-content code {
        font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
        background-color: #f6f8fa;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 85%;
    }
    
    .ai-buddy-response-content pre {
        background-color: #f6f8fa;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 12px 0;
    }
    
    .ai-buddy-response-content pre code {
        background-color: transparent;
        padding: 0;
    }
    
    /* 引用块 */
    .ai-buddy-response-content blockquote {
        border-left: 4px solid #dfe2e5;
        padding-left: 16px;
        margin-left: 0;
        margin-right: 0;
        margin-top: 12px;
        margin-bottom: 12px;
        color: #6a737d;
    }
    
    /* 链接样式 */
    .ai-buddy-response-content a {
        color: #0366d6;
        text-decoration: none;
    }
    
    .ai-buddy-response-content a:hover {
        text-decoration: underline;
    }
    
    /* 水平线 */
    .ai-buddy-response-content hr {
        height: 1px;
        background-color: #e1e4e8;
        border: none;
        margin: 16px 0;
    }
    
    /* 自定义滚动条 */
    .ai-buddy-response-content::-webkit-scrollbar {
        width: 8px;
    }
    
    .ai-buddy-response-content::-webkit-scrollbar-thumb {
        background-color: #d1d5db;
        border-radius: 4px;
    }
    
    .ai-buddy-response-content::-webkit-scrollbar-thumb:hover {
        background-color: #a8adb3;
    }
    
    .ai-buddy-response-content::-webkit-scrollbar-track {
        background-color: #f1f1f1;
        border-radius: 4px;
    }
    
    /* 关闭按钮样式 */
    .ai-buddy-close-button {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        padding: 6px;
        border-radius: 50%;
        line-height: 1;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }
    
    .ai-buddy-close-button:hover {
        background-color: #f0f0f0;
    }
`;

// 应用样式
const styleElement = document.createElement('style');
styleElement.textContent = improvedStyles;
document.head.appendChild(styleElement);

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