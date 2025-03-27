// AI Buddy 提示选项配置
// 用户可以根据需要自定义此文件中的选项

// 网站特定系统提示配置
const domainPrompts = {
  "github.com": "你正在分析GitHub页面上的代码或内容。请注意识别代码片段、Pull Request的内容或Issues的描述。分析时考虑软件开发上下文。",
  "stackoverflow.com": "你正在查看Stack Overflow上的问题或回答。请帮助理解其中的技术问题，并提供清晰的解释。如有代码片段，请分析代码的目的和可能存在的问题。",
  "docs.google.com": "你正在查看Google Docs文档。请帮助分析文档内容，提供有关改进文档结构或内容的建议。",
  "arxiv.org": "你正在查看arXiv学术论文。请提供简明扼要的论文摘要解释，重点突出核心方法与贡献。",
  "notion.so": "你正在查看Notion文档。请帮助理解、总结或改进文档内容。",
  // 可添加更多网站配置...
  
  // 通用配置，当找不到特定网站配置时使用
  "default": "请分析以下文字内容，提供清晰的解释或见解："
};

const promptOptions = [
  {
    name: "LLM",
    subMenu: [
      { 
        name: "解释内容", 
        prompt: "请解释以下内容：",
        systemPrompt: true  // 使用网站特定的系统提示
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
        paramName: "id"
      },
      {
        name: "order查询",
        isApi: true,
        apiUrl: "http://localhost:7070/api/service1/orders",
        method: "POST",
        params: {
          "flow": "order"
        },
        paramName: "id"
      }
    ]
  },
  {
    name: "LLM OPS",
    subMenu: [
      {
        name: "Diagnosis",
        systemPrompt: true
      }
    ]
  }
];

// 导出配置
export { promptOptions, domainPrompts }; 