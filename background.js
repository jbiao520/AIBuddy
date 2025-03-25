// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('AI Reading Buddy installed');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    
    if (request.type === 'getAIResponse') {
        // 使用fetch API直接调用本地LLM
        fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost'
            },
            body: JSON.stringify({
                'model': 'gemma3:12b',
                'prompt': request.text,
                'stream': false
            })
        })
        .then(response => {
            // Check if response is ok before parsing JSON
            if (!response.ok) {
                console.error('HTTP error! Status:', response);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('LLM Response:', data);
            // 只发送需要显示的响应数据，将完整JSON放在单独字段中
            sendResponse({
                displayText: data.response || "No response data from LLM",
                fullData: data, // 完整JSON数据，供用户选择性展开查看
            });
        })
        .catch(error => {
            console.error('Error fetching from LLM:', error);
            sendResponse({
                displayText: "Error connecting to local LLM. Please check if it's running.",
                error: error.message
            });
        });
        
        return true; // 保持连接开放以进行异步响应
    }
});

