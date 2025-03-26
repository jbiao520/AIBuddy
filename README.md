# AI Reading Buddy Chrome Extension

A Chrome extension that enhances reading efficiency by providing AI-powered insights for selected text using a local LLM.

## Features

- Select text on any webpage to get AI-powered insights
- Quick and easy-to-use floating button interface
- Clean and modern popup design
- Local LLM integration for privacy and speed

## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Local LLM Setup

This extension requires a local LLM server running on port 3000. The server should expose two endpoints:

- `POST /analyze` - Accepts JSON with a `text` field and returns analysis
- `GET /status` - Returns the server status

Make sure your local LLM server is running before using the extension.

## Usage

1. Select any text on a webpage
2. Click the robot icon (🤖) that appears near your selection
3. Wait for the AI analysis to appear in a popup
4. Click the × to close the popup when done

## Development

The extension consists of the following files:

- `manifest.json` - Extension configuration
- `content.js` - Handles text selection and popup display
- `popup.html/js` - Extension popup interface
- `background.js` - Background processes
- `styles.css` - Styling for the UI elements

## Contributing

Feel free to submit issues and enhancement requests!

# AI Buddy 配置说明

## 自定义提示选项

你可以通过编辑 `prompt-config.js` 文件来自定义提示选项。

### 配置格式说明

```javascript
const promptOptions = [
  {
    name: "菜单组名称",
    subMenu: [
      { 
        name: "选项名称", 
        prompt: "发送到LLM的提示前缀"
      },
      // ... 更多选项
    ]
  },
  // API调用示例
  {
    name: "API调用",
    subMenu: [
      {
        name: "GET请求示例",
        isApi: true,            // 标记为API调用
        apiUrl: "http://your-api-url",
        method: "GET",
        params: {               // 请求参数
          param1: "value1"  
        },
        paramName: "paramName"  // 选中文本将作为此参数
      }
    ]
  }
];
```

### 支持的选项类型

1. **LLM提示**：直接发送到语言模型的提示
2. **API调用**：`isApi: true`，支持GET和POST请求
3. **自定义提示**：`isCustom: true`，允许用户输入自定义提示

### 更改后生效

修改配置文件后，请刷新或重新加载扩展以使更改生效。 