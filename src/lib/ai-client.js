import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'data', 'config.json');
const config = (() => {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
})();

const API_KEY = process.env.ZHIPUAI_API_KEY || config.zhipuai_api_key;
const API_URL = process.env.ZHIPUAI_API_URL
  || config.zhipuai_api_url
  || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const DEFAULT_MODEL = process.env.ZHIPUAI_MODEL || config.zhipuai_model || 'glm-4.7';

/**
 * 调用智谱AI GLM-4.7 API（支持Function Calling）
 * @param {Array} messages - 消息历史
 * @param {Array} tools - 工具定义（Function Schema）
 * @param {string} model - 模型名称
 * @returns {Promise<Object>} API响应
 */
export async function callZhipuAI(messages, tools = null, model = DEFAULT_MODEL) {
  if (!API_KEY) {
    throw new Error('未配置智谱AI API Key');
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };

  const body = {
    model,
    messages,
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 4096
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`智谱AI API错误: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * 处理多轮对话（支持多次工具调用）
 * @param {Array} messages - 消息历史
 * @param {Array} tools - 工具定义
 * @param {Function} toolExecutor - 工具执行函数
 * @param {number} maxIterations - 最大迭代次数
 * @returns {Promise<Object>} 最终响应
 */
export async function chatWithTools(messages, tools, toolExecutor, maxIterations = 10) {
  let currentMessages = [...messages];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const response = await callZhipuAI(currentMessages, tools);
    const assistantMessage = response.choices[0].message;

    // 添加助手消息到历史
    currentMessages.push(assistantMessage);

    // 检查是否有工具调用
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // 没有工具调用，返回最终响应
      return {
        content: assistantMessage.content || '',
        tool_calls: null,
        messages: currentMessages
      };
    }

    // 执行所有工具调用
    for (const toolCall of assistantMessage.tool_calls) {
      const { id, function: func } = toolCall;
      const toolName = func.name;
      const toolArgs = JSON.parse(func.arguments);

      try {
        const result = await toolExecutor(toolName, toolArgs);
        const toolMessage = {
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify(result)
        };
        currentMessages.push(toolMessage);
      } catch (error) {
        const toolMessage = {
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify({ error: error.message })
        };
        currentMessages.push(toolMessage);
      }
    }
  }

  throw new Error('达到最大迭代次数限制');
}

/**
 * 从URL中提取JWT的payload部分用于获取user_id
 * @param {string} jwt - JWT token
 * @returns {Object} payload
 */
export function parseJWTPayload(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString());
  } catch {
    return null;
  }
}

/**
 * 构建系统提示词
 * @param {string} pageType - 页面类型
 * @returns {string} 系统提示词
 */
export function buildSystemPrompt(pageType) {
  const basePrompt = `你是一个专业的量化研究助手，服务于股票量化研究员。

研究员使用逐笔成交数据（包括成交量、成交价、成交金额、主动买入或主动卖出标识、买单订单编号、卖单订单编号、成交的时间戳）和盘口快照数据（包括从开盘到本次快照的累积成交量、当前价格、盘口买1档～买10档挂单量和挂单价、盘口卖1档～卖10档的挂单价、盘口买单挂单量总和、盘口卖单挂单量总和、买入挂单量加权平均的买入挂单价、卖出挂单量加权平均的卖出挂单价、本次快照的时间戳）来构造日频的股票因子。

当前论坛是团队已有的因子成果库。研究员可能会：
1. 讨论新想法——如果新想法与已有因子成果类似或重复，请告知
2. 讨论已有成果——回答前请仔细查询分析论坛中的相关内容

**重要原则：**
- 只以当前论坛中的数据为依据，不要引入外部数据
- 关于因子构造的内容，以论坛中的数据为准
- 除非研究员明确要求创新或给出另类构造方向
- 使用工具获取数据后再回答，不要编造信息
- 回答要简洁准确
- 如果没有找到相关信息，直接告诉用户

**引用格式要求：**
- 提及帖子时：给出发帖人名称、帖子准确名称、跳转链接
- 提及评论时：给出评论所属的帖子、发表评论的人名称、评论所属的标签
- 提及收藏或待办时：给出所属用户名称、来自哪个帖子

用户当前在"${pageType}"页面。你可以使用工具来查询数据库中的帖子、评论、成果、收藏和待办内容。`;

  return basePrompt;
}
