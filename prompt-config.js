// AI Buddy 提示选项配置
// 用户可以根据需要自定义此文件中的选项

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

// 导出配置
export default promptOptions; 