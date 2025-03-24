document.addEventListener('DOMContentLoaded', async () => {
    const statusElement = document.getElementById('llm-status');
    
    try {
        const response = await fetch('http://localhost:3000/status');
        const data = await response.json();
        
        if (data.status === 'running') {
            statusElement.textContent = '✅ Connected';
            statusElement.style.color = '#4caf50';
        } else {
            statusElement.textContent = '❌ Not Connected';
            statusElement.style.color = '#f44336';
        }
    } catch (error) {
        statusElement.textContent = '❌ Not Connected';
        statusElement.style.color = '#f44336';
    }
}); 