import { createSession, chatWithSession, extractTextFromResponse } from './opencode-client.js';
import { postSummaryQueries } from './db.js';

// 复用同一个session来生成所有摘要
let summarySessionId = null;

async function getSummarySession() {
  if (!summarySessionId) {
    const sessionData = await createSession('批量生成帖子摘要');
    summarySessionId = sessionData?.id || sessionData?.sessionId || sessionData?.session_id;
    if (!summarySessionId) {
      throw new Error('OpenCode会话创建失败');
    }
    console.log('创建摘要生成会话:', summarySessionId);
  }
  return summarySessionId;
}

/**
 * 为帖子生成摘要（使用_text版本内容）
 * @param {number} postId - 帖子ID
 * @returns {Object} 摘要对象
 */
export async function generatePostSummary(postId) {
  const db = (await import('./db.js')).getDb();

  // 获取帖子及_text内容
  const post = db.prepare(`
    SELECT p.id, p.title, p.content,
           pt.content as text_content, pt.ocr_status
    FROM posts p
    LEFT JOIN posts_text pt ON p.id = pt.post_id
    WHERE p.id = ?
  `).get(postId);

  if (!post) {
    throw new Error('帖子不存在');
  }

  // 优先使用OCR识别后的text_content
  const contentToUse = post.text_content || post.content || '';

  const prompt = `请分析以下量化研究帖子，生成结构化摘要。

**帖子标题**：${post.title}

**帖子内容**：
${contentToUse.slice(0, 8000) || '(无内容)'}

请以JSON格式返回摘要，包含以下字段：
- main_topic: 主要主题（1句话，不超过50字）
- main_logic: 主要逻辑（2-3句话，不超过150字）
- factors: 因子列表（数组，每个因子包含name和description）
- key_concepts: 关键概念（数组，包括术语、方法、数据等）
- summary: 完整摘要（3-5句话，不超过300字）

**要求**：
1. 准确理解帖子的核心内容
2. 提取所有因子名称和描述
3. 识别关键概念（即使是非标准术语也要提取）
4. 用简洁的中文表达

**重要：**
- 必须**只**返回JSON格式，不要有任何其他说明文字
- 即使内容为空或无法分析，也必须返回有效的JSON结构（字段值可以为空字符串或空数组）
- 不要返回"抱歉"之类的说明，直接返回JSON

格式示例：
\`\`\`json
{"main_topic":"...","main_logic":"...","factors":[...],"key_concepts":[...],"summary":"..."}
\`\`\``;

  try {
    const sessionId = await getSummarySession();
    const response = await chatWithSession(sessionId, prompt, '你是一个专业的量化研究助手。');
    const content = extractTextFromResponse(response);

    // 检测AI返回的是否是非JSON的文本说明
    const trimmedContent = content.trim();
    if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('```')) {
      console.warn('AI返回非JSON响应，使用基础摘要:', content.slice(0, 100));
      throw new Error('AI未返回JSON格式');
    }

    // 提取JSON（可能被包裹在代码块中）
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[1] : content;

    // 清理AI返回的不规范JSON
    jsonStr = jsonStr.trim();

    // 尝试修复被截断的JSON
    function fixTruncatedJSON(str) {
      let fixed = str;

      // 统计未闭合的括号和引号
      let openBraces = 0;
      let openBrackets = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < fixed.length; i++) {
        const char = fixed[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') openBraces++;
          else if (char === '}') openBraces--;
          else if (char === '[') openBrackets++;
          else if (char === ']') openBrackets--;
        }
      }

      // 如果字符串未闭合，闭合它
      if (inString) {
        fixed = fixed.slice(0, fixed.lastIndexOf('"'));
      }

      // 补全未闭合的数组和对象
      while (openBrackets > 0) {
        fixed += ']';
        openBrackets--;
      }
      while (openBraces > 0) {
        fixed += '}';
        openBraces--;
      }

      // 如果截断在字段值中间，补全
      if (!fixed.endsWith('}')) {
        // 移除最后不完整的字段
        const lastComma = fixed.lastIndexOf(',');
        if (lastComma > 0) {
          fixed = fixed.slice(0, lastComma);
        }
        // 补全缺失的必需字段
        const hasFields = {};
        fixed.match(/"(\w+)":/g)?.forEach(m => {
          hasFields[m.match(/"(\w+)":/)[1]] = true;
        });
        if (!hasFields.factors) fixed += ',"factors":[]';
        if (!hasFields.key_concepts) fixed += ',"key_concepts":[]';
        if (!hasFields.summary) fixed += ',"summary":""';
        fixed += '}';
      }

      return fixed;
    }

    // 尝试多种解析方式
    let summary;
    let lastError = null;

    // 方法1: 标准JSON.parse
    try {
      summary = JSON.parse(jsonStr);
    } catch (e) {
      lastError = e;

      // 方法2: 修复截断后解析
      try {
        const fixed = fixTruncatedJSON(jsonStr);
        summary = JSON.parse(fixed);
      } catch (e2) {
        lastError = e2;

        // 方法3: 修复引号问题后解析
        try {
          let fixed = jsonStr;
          fixed = fixed.replace(/"([^"]+)":\s*([a-zA-Z\u4e00-\u9fa5][^",}\]]*)/g, '"$1": "$2"');
          summary = JSON.parse(fixed);
        } catch (e3) {
          lastError = e3;

          // 方法4: 使用eval解析（最宽松）
          try {
            summary = eval(`(${jsonStr})`);
          } catch (e4) {
            console.warn('JSON解析完全失败，原始内容:', jsonStr.slice(0, 500));
            throw lastError;
          }
        }
      }
    }

    return {
      post_id: postId,
      main_topic: summary.main_topic || '',
      main_logic: summary.main_logic || '',
      factors: JSON.stringify(summary.factors || []),
      key_concepts: JSON.stringify(summary.key_concepts || []),
      summary: summary.summary || '',
      ai_model: 'opencode-glm-4.7'
    };
  } catch (error) {
    console.error('生成摘要失败:', error);
    // 返回基础摘要
    return {
      post_id: postId,
      main_topic: post.title || '',
      main_logic: `关于${post.title || '量化因子'}的研究`,
      factors: '[]',
      key_concepts: '[]',
      summary: `帖子标题：${post.title || '未知'}`,
      ai_model: 'opencode-glm-4.7'
    };
  }
}

/**
 * 保存摘要到数据库
 * @param {Object} summary - 摘要对象
 * @returns {Object} 数据库操作结果
 */
export function savePostSummary(summary) {
  const exists = postSummaryQueries.exists(summary.post_id);
  if (exists) {
    return postSummaryQueries.update(
      summary.post_id,
      summary.main_topic,
      summary.main_logic,
      summary.factors,
      summary.key_concepts,
      summary.summary
    );
  } else {
    return postSummaryQueries.create(
      summary.post_id,
      summary.main_topic,
      summary.main_logic,
      summary.factors,
      summary.key_concepts,
      summary.summary,
      summary.ai_model
    );
  }
}

/**
 * 重新生成摘要
 * @param {number} postId - 帖子ID
 */
export async function regeneratePostSummary(postId) {
  const summary = await generatePostSummary(postId);
  savePostSummary(summary);
  return summary;
}

/**
 * 批量为现有帖子生成摘要（强制覆盖现有摘要）
 * @returns {Object} 统计信息
 */
export async function generateSummariesForExistingPosts() {
  const db = (await import('./db.js')).getDb();
  const posts = db.prepare(`
    SELECT p.id, p.title, p.content,
           pt.content as text_content, pt.ocr_status
    FROM posts p
    LEFT JOIN posts_text pt ON p.id = pt.post_id
    ORDER BY p.created_at DESC
  `).all();

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const post of posts) {
    try {
      // 如果有图片但OCR未完成，跳过
      if (post.content && post.content.includes('![') && !post.text_content) {
        console.log(`跳过帖子 ${post.id} (${post.title}): OCR未完成`);
        skippedCount++;
        continue;
      }

      const summary = await generatePostSummary(post.id);
      savePostSummary(summary);
      successCount++;
      console.log(`已为帖子 ${post.id} (${post.title}) 生成摘要`);

      // 添加延迟避免请求过快
      if (posts.indexOf(post) < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failCount++;
      console.error(`为帖子 ${post.id} 生成摘要失败:`, error.message);
    }
  }

  return {
    total: posts.length,
    success: successCount,
    fail: failCount,
    skipped: skippedCount
  };
}
