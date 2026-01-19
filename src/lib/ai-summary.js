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

**重要：** 请只返回JSON格式的摘要，不要有任何其他说明文字。格式示例：
\`\`\`json
{"main_topic":"...","main_logic":"...","factors":[...],"key_concepts":[...],"summary":"..."}
\`\`\``;

  try {
    const sessionId = await getSummarySession();
    const response = await chatWithSession(sessionId, prompt, '你是一个专业的量化研究助手。');
    const content = extractTextFromResponse(response);

    // 提取JSON（可能被包裹在代码块中）
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[1] : content;

    // 直接使用eval解析格式化的JSON（更宽松）
    let summary;
    try {
      // 先尝试标准JSON.parse（处理单行JSON）
      summary = JSON.parse(jsonStr);
    } catch (parseError) {
      // 如果失败，使用eval解析格式化的JSON
      try {
        summary = eval(`(${jsonStr})`);
      } catch (evalError) {
        console.warn('JSON解析完全失败，原始内容:', jsonStr.slice(0, 500));
        throw parseError;
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
