let floatingButton = null;
let promptMenu = null;
let selectedTextContent = "";

// Define different prompt options
const promptOptions = [
  { 
    name: "解释内容", 
    prompt: "请用100以内的字数解释以下内容：" 
  },
  { 
    name: "总结内容", 
    prompt: "请用100以内的字数总结以下关键点：" 
  },
  { 
    name: "简化表达", 
    prompt: "请用100以内的字数更简单的语言重写以下内容：" 
  },
  { 
    name: "翻译成中文", 
    prompt: "请用不超过原文的字数将以下内容翻译成中文：" 
  },
  { 
    name: "批判性分析", 
    prompt: "请用100以内的字数对以下内容进行批判性分析：" 
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
            event.target.closest('.ai-buddy-prompt-menu') ||
            event.target.closest('.ai-buddy-response-popup') ||
            event.target.closest('.ai-buddy-custom-prompt')) {
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
            
            document.body.appendChild(floatingButton);
        }
    }, 50);
});

// Listen for clicks on the entire document
document.addEventListener('click', (event) => {
    // Handle clicking the floating button
    if (event.target.closest('.ai-buddy-floating-button')) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.target.closest('.ai-buddy-floating-button');
        const x = parseInt(button.dataset.posX);
        const y = parseInt(button.dataset.posY);
        
        // If menu exists, remove it
        if (promptMenu && promptMenu.parentNode) {
            document.body.removeChild(promptMenu);
            promptMenu = null;
        } else {
            // Otherwise create menu
            createPromptMenu(selectedTextContent, x, y + 40);
        }
        return;
    }
    
    // Handle clicking menu items
    if (event.target.closest('.ai-buddy-menu-item')) {
        event.preventDefault();
        event.stopPropagation();
        
        const menuItem = event.target.closest('.ai-buddy-menu-item');
        const optionIndex = parseInt(menuItem.dataset.index);
        const option = promptOptions[optionIndex];
        
        if (option.isCustom) {
            // Show custom prompt input
            showCustomPromptInput(
                parseInt(floatingButton.dataset.posX),
                parseInt(floatingButton.dataset.posY)
            );
            return;
        }
        
        // Show loading indicator
        menuItem.innerHTML = '⏳ ' + option.name;
        menuItem.style.pointerEvents = 'none';
        
        // Get button position
        let x = 0, y = 0;
        if (floatingButton) {
            x = parseInt(floatingButton.dataset.posX);
            y = parseInt(floatingButton.dataset.posY);
        }
        
        // Combine prompt and selected text
        const fullPrompt = option.prompt + " " + selectedTextContent;
        
        sendPromptToLLM(fullPrompt, x, y);
        return;
    }
    
    // Handle custom prompt submission
    if (event.target.closest('.ai-buddy-custom-submit')) {
        event.preventDefault();
        event.stopPropagation();
        
        const customInput = document.querySelector('.ai-buddy-custom-input');
        if (customInput && customInput.value.trim()) {
            const customPrompt = customInput.value.trim() + " " + selectedTextContent;
            
            // Get button position
            let x = 0, y = 0;
            if (floatingButton) {
                x = parseInt(floatingButton.dataset.posX);
                y = parseInt(floatingButton.dataset.posY);
            }
            
            // Remove custom prompt UI
            const customPromptContainer = document.querySelector('.ai-buddy-custom-prompt');
            if (customPromptContainer && customPromptContainer.parentNode) {
                document.body.removeChild(customPromptContainer);
            }
            
            sendPromptToLLM(customPrompt, x, y);
        }
        return;
    }
    
    // Handle cancel custom prompt
    if (event.target.closest('.ai-buddy-custom-cancel')) {
        event.preventDefault();
        event.stopPropagation();
        
        const customPromptContainer = document.querySelector('.ai-buddy-custom-prompt');
        if (customPromptContainer && customPromptContainer.parentNode) {
            document.body.removeChild(customPromptContainer);
        }
        return;
    }
    
    // Clear floating elements when clicking elsewhere
    if (!event.target.closest('.ai-buddy-response-popup') && 
        !event.target.closest('.ai-buddy-custom-prompt')) {
        removeFloatingElements();
        
        const customPromptContainer = document.querySelector('.ai-buddy-custom-prompt');
        if (customPromptContainer && customPromptContainer.parentNode) {
            document.body.removeChild(customPromptContainer);
        }
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
function createPromptMenu(selectedText, x, y) {
    promptMenu = document.createElement('div');
    promptMenu.className = 'ai-buddy-prompt-menu';
    promptMenu.style.left = `${x}px`;
    promptMenu.style.top = `${y}px`;
    
    // Create menu items for each prompt option
    promptOptions.forEach((option, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'ai-buddy-menu-item';
        menuItem.textContent = option.name;
        menuItem.dataset.index = index; // Store option index
        
        promptMenu.appendChild(menuItem);
    });
    
    document.body.appendChild(promptMenu);
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