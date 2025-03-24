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
                'prompt': '你是一个AI助手，用户选中了这一段话，你来给解释一下：'+request.text,
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
            sendResponse({data: data.response || "No response data from LLM"});
        });
        
        return true; // 保持连接开放以进行异步响应
    }
}); 