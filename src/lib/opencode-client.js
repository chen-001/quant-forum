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
