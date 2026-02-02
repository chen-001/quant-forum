import fs from 'fs';
import path from 'path';
import { postSummaryQueries } from './db.js';

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

// Zenmux AI 配置 (moonshotai/kimi-k2.5)
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY || config.zenmux_api_key;
const ZENMUX_API_URL = process.env.ZENMUX_API_URL
  || config.zenmux_api_url
  || 'https://zenmux.ai/api/anthropic/v1/messages';
const ZENMUX_MODEL = process.env.ZENMUX_MODEL || config.zenmux_model || 'moonshotai/kimi-k2.5';

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
 * 调用 Zenmux AI API (moonshotai/kimi-k2.5)
 * 支持传入文字和图片(base64格式)
 * @param {string} textContent - 文字内容
 * @param {Array<string>} imageBase64List - base64编码的图片列表
 * @returns {Promise<Object>} API响应
 */
export async function callZenmuxAI(textContent, imageBase64List = []) {
  if (!ZENMUX_API_KEY) {
    throw new Error('未配置 Zenmux AI API Key');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ZENMUX_API_KEY}`,
    'anthropic-version': '2023-06-01'
  };

  // 构建消息内容，支持多模态
  const content = [];

  // 添加所有图片
  for (const base64Image of imageBase64List) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: base64Image.replace(/^data:image\/\w+;base64,/, '')
      }
    });
  }

  // 添加文字内容
  if (textContent && textContent.trim()) {
    content.push({
      type: 'text',
      text: textContent
    });
  }

  const body = {
    model: ZENMUX_MODEL,
    max_tokens: 64000,
    messages: [
      {
        role: 'user',
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text  // 只有文字时直接传字符串
          : content  // 有多模态内容时传数组
      }
    ]
  };

  const response = await fetch(ZENMUX_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zenmux AI API错误: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // 转换为与 OpenAI/智谱AI 兼容的格式
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: data.content?.[0]?.text || data.completion || ''
        }
      }
    ]
  };
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
 * 获取所有帖子摘要的格式化文本
 * @returns {string} 格式化的摘要文本
 */
function getFormattedSummaries() {
  try {
    const summaries = postSummaryQueries.getAll();
    if (!summaries || summaries.length === 0) {
      return '（暂无帖子摘要）';
    }

    return summaries.map(s => {
      const factors = s.factors ? JSON.parse(s.factors) : [];
      const keyConcepts = s.key_concepts ? JSON.parse(s.key_concepts) : [];
      
      return `【帖子ID: ${s.post_id}】《${s.post_title || '无标题'}》
- 作者：${s.author_name || '未知'}
- 主题：${s.main_topic || '无'}
- 核心逻辑：${s.main_logic || '无'}
- 因子列表：${factors.length > 0 ? factors.join('、') : '无'}
- 关键概念：${keyConcepts.length > 0 ? keyConcepts.join('、') : '无'}
- 摘要：${s.summary || '无'}`;
    }).join('\n\n');
  } catch (error) {
    console.error('获取帖子摘要失败:', error);
    return '（获取帖子摘要失败）';
  }
}

/**
 * 构建系统提示词
 * @param {string} pageType - 页面类型
 * @returns {string} 系统提示词
 */
export function buildSystemPrompt(pageType) {
  const summariesText = getFormattedSummaries();
  
  const basePrompt = `你是一个专业的量化研究助手，服务于股票量化研究员。

研究员使用逐笔成交数据（包括成交量、成交价、成交金额、主动买入或主动卖出标识、买单订单编号、卖单订单编号、成交的时间戳）（订单编号代表了挂单的时间）和盘口快照数据（包括从开盘到本次快照的累积成交量、当前价格、盘口买1档～买10档挂单量和挂单价、盘口卖1档～卖10档的挂单价、盘口买单挂单量总和、盘口卖单挂单量总和、买入挂单量加权平均的买入挂单价、卖出挂单量加权平均的卖出挂单价、本次快照的时间戳）来构造日频的股票因子。

当前论坛是团队已有的因子成果库，汇集了团队的量化研究成果。研究员可能会：
1. 讨论新想法——请深入理解其思路本质，帮助澄清和完善想法
2. 讨论已有成果——回答前请仔细查询分析论坛中的相关内容

**核心工作原则：**
- 优先理解研究员的思路本质，利用你的量化知识库帮助澄清和细化想法
- 将论坛内容作为重要参考，用于了解团队已有的研究方向和成果
- 当新想法与论坛中某个因子高度相似（构造逻辑、数据使用、核心思路基本一致）时，请提醒研究员并给出相关参考
- 鼓励创新思维，不要因为思路另类就轻易判定为不相关或不可行
- 回答要简洁准确
- 当前论坛上的内容都是与股票量化研究相关的，如果你看到某些信息与股票量化无关，请仔细思考它们与股票量化之前的潜在联系，不要轻易忽略，因为他们很可能是研究员联想的关键线索或一个生动形象的比喻
- 如果实在没有找到相关信息，直接告诉用户

**论坛帖子摘要（你可以直接参考这些信息了解论坛内容）：**

${summariesText}

**深入了解帖子内容：**
当你需要了解某个帖子的详细内容时，可以使用工具：
- \`getPostDetail\` 获取帖子完整内容
- \`getPostComments\` 获取帖子评论
- \`getPostResults\` 获取帖子成果
- \`getPostIdeas\` 获取帖子想法区

**引用格式要求：**
- 提及帖子时：给出发帖人名称、帖子准确名称（注意是帖子标题，而不是编号）、跳转链接（格式：/post/{帖子ID}）
- 提及评论时：给出评论所属的帖子标题、发表评论的人名称、评论所属的标签
- 提及收藏或待办时：给出所属用户名称、来自哪个帖子的标题

用户当前在"${pageType}"页面。`;

  return basePrompt;
}
