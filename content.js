let floatingButton = null;
let selectedTextGlobal = "";
let eventPositionX = 0; 
let eventPositionY = 0;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {
    console.log("Content script received message:", message);
    
    if (message.type === 'aiResponse') {
        if (message.data) {
            showResponsePopup(message.data, eventPositionX, eventPositionY);
        } else if (message.error) {
            showResponsePopup("Error: " + message.error, eventPositionX, eventPositionY);
        }
        
        // Remove the loading indicator
        if (floatingButton && floatingButton.parentNode) {
            document.body.removeChild(floatingButton);
            floatingButton = null;
        }
    }
});

document.addEventListener('mouseup', (event) => {
    // Prevent processing if this is part of a click on our button
    if (event.target.className === 'ai-buddy-floating-button') {
        return;
    }
    
    const selectedText = window.getSelection().toString().trim();
    selectedTextGlobal = selectedText;
    eventPositionX = event.pageX;
    eventPositionY = event.pageY;
    
    // Remove existing floating button if it exists
    if (floatingButton) {
        document.body.removeChild(floatingButton);
        floatingButton = null;
    }
    
    if (selectedText.length > 0) {
        // Create floating button
        floatingButton = document.createElement('div');
        floatingButton.className = 'ai-buddy-floating-button';
        floatingButton.innerHTML = '🤖';
        
        // Position the button near the mouse
        const x = event.pageX + 10;
        const y = event.pageY - 30;
        
        floatingButton.style.left = `${x}px`;
        floatingButton.style.top = `${y}px`;

        // Add click handler with a small delay to avoid mouseup/click conflicts
        floatingButton.addEventListener('click', function(e) {
            // Stop propagation to prevent other handlers from firing
            e.stopPropagation();
            console.log("Button clicked, sending request for:", selectedTextGlobal);
            // 显示加载指示器
            this.innerHTML = '⏳';
            this.style.pointerEvents = 'none';
            
            // 直接从content script发送请求
            // Use the background script to make the request to avoid CORS issues
            chrome.runtime.sendMessage({
                type: 'getAIResponse',
                text: selectedTextGlobal
            }, function(response) {
                console.log("Received response:", response);
                
                if (response && response.data) {
                    // Format the response nicely
                    const formattedResponse = response.data;
                    showResponsePopup(formattedResponse, eventPositionX, eventPositionY);
                } else if (response && response.error) {
                    showResponsePopup("Error: " + response.error, eventPositionX, eventPositionY);
                } else {
                    showResponsePopup("No response from AI service", eventPositionX, eventPositionY);
                }
                
                // 移除浮动按钮
                if (floatingButton && floatingButton.parentNode) {
                    document.body.removeChild(floatingButton);
                    floatingButton = null;
                }
            });
        });
        
        document.body.appendChild(floatingButton);
    }
});

// Hide floating button when clicking elsewhere
document.addEventListener('mousedown', (event) => {
    if (floatingButton && !floatingButton.contains(event.target)) {
        document.body.removeChild(floatingButton);
        floatingButton = null;
    }
});

function showResponsePopup(response, x, y) {
    const popup = document.createElement('div');
    popup.className = 'ai-buddy-response-popup';
    popup.textContent = response;
    
    // Position popup
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'ai-buddy-close-button';
    closeButton.textContent = '×';
    closeButton.onclick = () => document.body.removeChild(popup);
    popup.appendChild(closeButton);
    
    document.body.appendChild(popup);
} 