const DEFAULT_BASE_URL = 'http://localhost:4096';

const baseURL = process.env.OPENCODE_BASE_URL || DEFAULT_BASE_URL;
const providerID = process.env.OPENCODE_PROVIDER_ID || 'zhipuai-coding-plan';
const modelID = process.env.OPENCODE_MODEL_ID || 'glm-4.7';
const agent = process.env.OPENCODE_AGENT || 'build';
const directory = process.env.OPENCODE_DIRECTORY || process.cwd();

// 禁用的危险工具列表（可修改文件或执行命令的工具）
const EXCLUDED_TOOL_IDS = [
  'edit',      // 编辑文件
  'write',     // 写入文件
  'bash',      // 执行 bash 命令
  'task'       // 启动子代理（可能绕过限制）
];

function buildUrl(path, query = {}) {
  const base = baseURL.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function parseResponse(response) {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!payload && text && /<html/i.test(text)) {
    throw new Error('OpenCode API returned HTML. Check OPENCODE_BASE_URL.');
  }

  if (!response.ok) {
    const message =
      payload?.error?.message
      || payload?.error
      || payload?.message
      || text
      || `OpenCode API error: ${response.status}`;
    throw new Error(message);
  }

  if (payload?.error) {
    const message = payload.error?.message || payload.error;
    throw new Error(message);
  }

  if (payload?.data?.error) {
    const message = payload.data.error?.message || payload.data.error;
    throw new Error(message);
  }

  return payload || { rawText: text };
}

export async function createSession(title = 'AI Chat') {
  const response = await fetch(buildUrl('/session', { directory }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title
    })
  });

  const payload = await parseResponse(response);
  return payload?.data || payload;
}

export async function chatWithSession(sessionId, text, system) {
  const response = await fetch(buildUrl(`/session/${sessionId}/message`, { directory }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: {
        providerID,
        modelID
      },
      agent,
      system: system || undefined,
      parts: [{ type: 'text', text }],
      excludeToolIDs: EXCLUDED_TOOL_IDS
    })
  });

  const payload = await parseResponse(response);
  return payload?.data || payload;
}

export function extractTextFromParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export function extractTextFromResponse(response) {
  if (!response) return '';

  const partsCandidates = [
    response.parts,
    response.data?.parts,
    response.message?.parts,
    response.output?.parts,
    response.response?.parts
  ];

  for (const parts of partsCandidates) {
    const text = extractTextFromParts(parts);
    if (text) return text;
  }

  const stringCandidates = [
    response.text,
    response.content,
    response.message?.text,
    response.message?.content,
    response.output?.text,
    response.output?.content,
    response.rawText
  ];

  for (const candidate of stringCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

/**
 * 流式处理OpenCode聊天事件（真正的流式输出）
 * 使用 prompt_async 发送消息，然后监听 /global/event SSE 获取实时事件
 * @param {string} sessionId - OpenCode会话ID
 * @param {string} text - 用户消息内容
 * @param {string} system - 系统提示词（可选）
 * @param {AbortSignal} signal - 用于取消请求的信号
 * @returns {AsyncGenerator} 生成器，产生事件对象
 */
export async function* streamChatEvents(sessionId, text, system, signal) {
  // 首先连接到 SSE 事件流（在发送消息之前连接，确保不会错过事件）
  const eventSourceUrl = buildUrl('/global/event', { directory });

  const eventResponse = await fetch(eventSourceUrl, {
    headers: { 'Accept': 'text/event-stream' },
    signal
  });

  if (!eventResponse.ok) {
    throw new Error(`OpenCode event stream error: ${eventResponse.status}`);
  }

  const reader = eventResponse.body.getReader();
  const decoder = new TextDecoder();

  // 然后异步发送消息（不等待响应）
  const promptUrl = buildUrl(`/session/${sessionId}/prompt_async`, { directory });
  
  const promptResponse = await fetch(promptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: { providerID, modelID },
      agent,
      system: system || undefined,
      parts: [{ type: 'text', text }],
      excludeToolIDs: EXCLUDED_TOOL_IDS
    }),
    signal
  });

  if (!promptResponse.ok) {
    reader.cancel().catch(() => {});
    const error = await promptResponse.text();
    throw new Error(`OpenCode prompt error: ${error}`);
  }

  let buffer = '';
  let messageCompleted = false;
  let assistantMessageStarted = false;
  
  // 按 partID 跟踪已输出的文本长度，用于提取增量
  const partLengths = new Map();

  try {
    while (!messageCompleted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (!data) continue;

        let eventWrapper;
        try {
          eventWrapper = JSON.parse(data);
        } catch {
          continue;
        }

        // OpenCode 事件格式是 { payload: { type, properties } } 或 { directory, payload: { type, properties } }
        const eventData = eventWrapper.payload || eventWrapper;
        if (!eventData?.type) continue;

        // 处理 message.part.updated 事件
        if (eventData.type === 'message.part.updated') {
          const part = eventData.properties?.part;
          if (!part || part.sessionID !== sessionId) {
            continue;
          }

          // 跳过用户消息的 part
          if (!assistantMessageStarted) {
            continue;
          }

          const partId = part.id;
          const lastLength = partLengths.get(partId) || 0;

          switch (part.type) {
            case 'reasoning':
              // OpenCode 返回累积的完整文本，需要提取增量
              if (part.text && part.text.length > lastLength) {
                const delta = part.text.slice(lastLength);
                partLengths.set(partId, part.text.length);
                yield { type: 'reasoning', text: delta };
              }
              break;

            case 'tool':
              yield {
                type: 'tool',
                tool: part.tool,
                status: part.state?.status,
                title: part.state?.title,
                input: part.state?.input,
                output: part.state?.output
              };
              break;

            case 'text':
              // OpenCode 返回累积的完整文本，需要提取增量
              if (part.text && part.text.length > lastLength) {
                const delta = part.text.slice(lastLength);
                partLengths.set(partId, part.text.length);
                yield { type: 'text', text: delta, isComplete: !!part.time?.end };
              }
              break;
          }
        }

        // 处理消息创建/更新事件
        if (eventData.type === 'message.updated') {
          const msg = eventData.properties?.info;
          if (msg?.sessionID === sessionId && msg?.role === 'assistant') {
            assistantMessageStarted = true;
            // 检查助手消息是否完成（有 time.end）
            if (msg.time?.end) {
              messageCompleted = true;
            }
          }
        }

        // 处理会话空闲状态
        if (eventData.type === 'session.idle') {
          if (assistantMessageStarted) {
            messageCompleted = true;
          }
        }

        // 处理会话状态变化
        if (eventData.type === 'session.updated') {
          const session = eventData.properties?.info || eventData.properties;
          if (session?.id === sessionId) {
            // 当会话更新且已经开始助手消息时，检查是否完成
            if (assistantMessageStarted && session.status === 'idle') {
              messageCompleted = true;
            }
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
