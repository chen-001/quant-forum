import { createSession, chatWithSession, extractTextFromResponse } from './opencode-client.js';
import { postSummaryQueries, summaryLogQueries } from './db.js';
import crypto from 'crypto';
import { diffLines } from 'diff';

// 复用同一个session来生成所有摘要
let summarySessionId = null;

async function getSummarySession() {
  if (!summarySessionId) {
    const sessionData = await createSession('批量生成帖子摘要');
    summarySessionId = sessionData?.id || sessionData?.sessionId || sessionData?.session_id;
    if (!summarySessionId) {
      throw new Error('OpenCode会话创建失败');
    }

  }
  return summarySessionId;
}

/**
 * 计算帖子内容的MD5哈希
 * @param {string} content - 帖子内容
 * @returns {string} MD5哈希值
 */
export function computePostHash(content) {
  return crypto.createHash('md5').update(content || '').digest('hex');
}

/**
 * 获取帖子完整内容（用于摘要生成）
 * 包含：正文、评论、想法区、成果区（均优先使用OCR识别的_text版本）
 * @param {number} postId - 帖子ID
 * @returns {Object} 帖子信息，包含合并后的全部内容
 */
async function getPostContent(postId) {
  const db = (await import('./db.js')).getDb();

  // 1. 获取帖子正文
  const post = db.prepare(`
    SELECT p.id, p.title, p.content,
           pt.content as text_content, pt.ocr_status
    FROM posts p
    LEFT JOIN posts_text pt ON p.id = pt.post_id
    WHERE p.id = ?
  `).get(postId);

  if (!post) return null;

  // 2. 获取评论内容（包含OCR）
  const comments = db.prepare(`
    SELECT c.content, ct.content as text_content
    FROM comments c
    LEFT JOIN comments_text ct ON c.id = ct.comment_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(postId);

  // 3. 获取想法区内容（包含OCR）
  const idea = db.prepare(`
    SELECT pi.content, pit.content as text_content
    FROM post_ideas pi
    LEFT JOIN post_ideas_text pit ON pi.id = pit.idea_id
    WHERE pi.post_id = ?
  `).get(postId);

  // 4. 获取成果区内容（包含OCR）
  const results = db.prepare(`
    SELECT r.content, rt.content as text_content
    FROM results r
    LEFT JOIN results_text rt ON r.id = rt.result_id
    WHERE r.post_id = ?
    ORDER BY r.created_at ASC
  `).all(postId);

  // 合并所有内容（优先使用text_content）
  const sections = [];

  // 正文
  const postContent = post.text_content || post.content || '';
  if (postContent.trim()) {
    sections.push(`【正文】\n${postContent}`);
  }

  // 想法区
  if (idea) {
    const ideaContent = idea.text_content || idea.content || '';
    if (ideaContent.trim()) {
      sections.push(`【想法区】\n${ideaContent}`);
    }
  }

  // 成果区
  const resultContents = results
    .map(r => r.text_content || r.content || '')
    .filter(c => c.trim());
  if (resultContents.length > 0) {
    sections.push(`【成果区】\n${resultContents.join('\n\n')}`);
  }

  // 评论区
  const commentContents = comments
    .map(c => c.text_content || c.content || '')
    .filter(c => c.trim());
  if (commentContents.length > 0) {
    sections.push(`【评论区】\n${commentContents.join('\n\n')}`);
  }

  // 合并后的完整内容
  post.combined_content = sections.join('\n\n---\n\n');

  return post;
}

/**
 * 解析AI返回的JSON
 * @param {string} content - AI返回内容
 * @returns {Object} 解析后的对象
 */
function parseAIResponse(content) {
  const trimmedContent = content.trim();
  if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('```')) {
    throw new Error('AI未返回JSON格式');
  }

  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
  let jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
  jsonStr = jsonStr.trim();

  function fixTruncatedJSON(str) {
    let fixed = str;
    let openBraces = 0, openBrackets = 0, inString = false, escapeNext = false;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (char === '\\') { escapeNext = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    }

    if (inString) fixed = fixed.slice(0, fixed.lastIndexOf('"'));
    while (openBrackets > 0) { fixed += ']'; openBrackets--; }
    while (openBraces > 0) { fixed += '}'; openBraces--; }

    if (!fixed.endsWith('}')) {
      const lastComma = fixed.lastIndexOf(',');
      if (lastComma > 0) fixed = fixed.slice(0, lastComma);
      const hasFields = {};
      fixed.match(/"(\w+)":/g)?.forEach(m => { hasFields[m.match(/"(\w+)":/)[1]] = true; });
      if (!hasFields.factors) fixed += ',"factors":[]';
      if (!hasFields.key_concepts) fixed += ',"key_concepts":[]';
      if (!hasFields.summary) fixed += ',"summary":""';
      fixed += '}';
    }
    return fixed;
  }

  let result;
  try { result = JSON.parse(jsonStr); }
  catch {
    try { result = JSON.parse(fixTruncatedJSON(jsonStr)); }
    catch {
      try {
        const fixed = jsonStr.replace(/"([^"]+)":\s*([a-zA-Z\u4e00-\u9fa5][^",}\]]*)/g, '"$1": "$2"');
        result = JSON.parse(fixed);
      } catch {
        try { result = eval(`(${jsonStr})`); }
        catch (e) { throw new Error(`JSON解析失败: ${jsonStr.slice(0, 200)}`); }
      }
    }
  }
  return result;
}

/**
 * 为帖子生成摘要（使用合并后的完整内容：正文+评论+想法区+成果区）
 * @param {number} postId - 帖子ID
 * @param {boolean} forceRegenerate - 是否强制重新生成（忽略哈希检查）
 * @returns {Object} 摘要对象，包含content_hash和content_snapshot
 */
export async function generatePostSummary(postId, forceRegenerate = false) {
  const post = await getPostContent(postId);
  if (!post) throw new Error('帖子不存在');

  // 使用合并后的完整内容（包含正文、评论、想法区、成果区）
  const contentToUse = post.combined_content || '';
  const contentHash = computePostHash(contentToUse);

  // 检查是否需要更新
  if (!forceRegenerate) {
    const existing = postSummaryQueries.getByPostId(postId);
    if (existing && existing.last_post_hash === contentHash) {
      return null;
    }
  }

  const prompt = `请分析以下量化研究帖子的完整内容，生成结构化摘要。

**帖子标题**：${post.title}

**帖子完整内容**（包含正文、想法区、成果区、评论区）：
${contentToUse.slice(0, 12000) || '(无内容)'}

请以JSON格式返回摘要，包含以下字段：
- main_topic: 主要主题（1句话，不超过50字）
- main_logic: 主要逻辑（2-3句话，不超过150字）
- factors: 因子列表（数组，每个因子包含name和description，必须提取所有出现的因子定义）
- key_concepts: 关键概念（数组，包括术语、方法、数据、公式等）
- summary: 完整摘要（3-5句话，不超过300字）

**要求**：
1. 综合分析正文、想法区、成果区和评论区的所有内容
2. **重点提取所有因子**：包括因子名称、计算公式、定义说明
3. 识别关键概念（即使是非标准术语也要提取）
4. 用简洁的中文表达

**重要：**
- 必须**只**返回JSON格式，不要有任何其他说明文字
- 即使内容为空或无法分析，也必须返回有效的JSON结构（字段值可以为空字符串或空数组）
- 不要返回"抱歉"之类的说明，直接返回JSON

格式示例：
\`\`\`json
{"main_topic":"...","main_logic":"...","factors":[{"name":"因子名","description":"公式和说明"}],"key_concepts":[...],"summary":"..."}
\`\`\``;

  try {
    const sessionId = await getSummarySession();
    const response = await chatWithSession(sessionId, prompt, '你是一个专业的量化研究助手。');
    const content = extractTextFromResponse(response);
    const summary = parseAIResponse(content);

    return {
      post_id: postId,
      main_topic: summary.main_topic || '',
      main_logic: summary.main_logic || '',
      factors: JSON.stringify(summary.factors || []),
      key_concepts: JSON.stringify(summary.key_concepts || []),
      summary: summary.summary || '',
      ai_model: 'opencode-glm-4.7',
      content_hash: contentHash,
      content_snapshot: contentToUse.slice(0, 50000)
    };
  } catch (error) {
    console.error('生成摘要失败:', error);
    return {
      post_id: postId,
      main_topic: post.title || '',
      main_logic: `关于${post.title || '量化因子'}的研究`,
      factors: '[]',
      key_concepts: '[]',
      summary: `帖子标题：${post.title || '未知'}`,
      ai_model: 'opencode-glm-4.7',
      content_hash: contentHash,
      content_snapshot: contentToUse.slice(0, 50000)
    };
  }
}

/**
 * 计算两个文本之间的差异，返回新增/修改的内容
 * @param {string} oldContent - 旧内容
 * @param {string} newContent - 新内容
 * @returns {string} 差异内容（新增和修改的部分）
 */
function computeContentDiff(oldContent, newContent) {
  if (!oldContent) return newContent;
  if (!newContent) return '';

  const diff = diffLines(oldContent, newContent);
  const diffParts = [];

  for (const part of diff) {
    if (part.added) {
      diffParts.push(part.value);
    }
  }

  return diffParts.join('');
}

/**
 * 生成增量摘要（仅分析新增内容）
 * @param {number} postId - 帖子ID
 * @returns {Object} 增量摘要对象
 */
export async function generateSupplementSummary(postId) {
  const post = await getPostContent(postId);
  if (!post) throw new Error('帖子不存在');

  // 使用合并后的完整内容
  const contentToUse = post.combined_content || '';
  const contentHash = computePostHash(contentToUse);

  const existing = postSummaryQueries.getByPostId(postId);
  if (!existing) throw new Error('该帖子还没有摘要，请先生成完整摘要');

  // 检查是否有内容变化
  if (existing.last_post_hash === contentHash) {
    return null;
  }

  // 计算新增内容
  const oldContent = existing.last_post_content_snapshot || '';
  const newContent = contentToUse;

  // 使用 diff 算法计算真正的差异（新增行）
  const diffContent = computeContentDiff(oldContent, newContent);

  if (!diffContent.trim()) {
    return null;
  }

  const prompt = `以下是帖子的【新增内容】，请只分析这部分新内容，生成补充摘要：

**帖子标题**：${post.title}

**新增内容**：
---
${diffContent.slice(0, 6000)}
---

请以JSON格式返回，包含以下字段：
- supplement_factors: 新增的因子（数组，每个包含name和description，如果没有则为空数组）
- supplement_concepts: 新增的关键概念（数组，如果没有则为空数组）
- supplement_summary: 新增内容的简要总结（1-2句话，不超过100字）

**重要**：
- 必须**只**返回JSON格式
- 如果新增内容没有因子或概念，对应字段返回空数组
- 只关注新增的内容，不要重复已有摘要中的信息

格式示例：
\`\`\`json
{"supplement_factors":[{"name":"因子X","description":"..."}],"supplement_concepts":["概念A"],"supplement_summary":"新增了..."}
\`\`\``;

  try {
    const sessionId = await getSummarySession();
    const response = await chatWithSession(sessionId, prompt, '你是一个专业的量化研究助手。');
    const content = extractTextFromResponse(response);
    const supplement = parseAIResponse(content);

    return {
      post_id: postId,
      supplement_factors: JSON.stringify(supplement.supplement_factors || []),
      supplement_concepts: JSON.stringify(supplement.supplement_concepts || []),
      supplement_summary: supplement.supplement_summary || '',
      content_hash: contentHash,
      content_snapshot: contentToUse.slice(0, 50000)
    };
  } catch (error) {
    console.error('生成增量摘要失败:', error);
    return null;
  }
}

/**
 * 保存摘要到数据库（智能判断完整更新或增量更新）
 * @param {Object} summary - 摘要对象
 * @returns {Object} 数据库操作结果
 */
export function savePostSummary(summary) {
  if (!summary) return { changes: 0 };

  const exists = postSummaryQueries.exists(summary.post_id);
  const hasUserEdit = exists && postSummaryQueries.hasUserEdit(summary.post_id);

  if (exists) {
    if (hasUserEdit) {
      // 有用户编辑：只更新AI原始字段，保留用户编辑
      return postSummaryQueries.updateWithHash(
        summary.post_id,
        summary.main_topic,
        summary.main_logic,
        summary.factors,
        summary.key_concepts,
        summary.summary,
        summary.content_hash,
        summary.content_snapshot
      );
    } else {
      // 无用户编辑：完整更新
      return postSummaryQueries.updateWithHash(
        summary.post_id,
        summary.main_topic,
        summary.main_logic,
        summary.factors,
        summary.key_concepts,
        summary.summary,
        summary.content_hash,
        summary.content_snapshot
      );
    }
  } else {
    return postSummaryQueries.createWithHash(
      summary.post_id,
      summary.main_topic,
      summary.main_logic,
      summary.factors,
      summary.key_concepts,
      summary.summary,
      summary.ai_model,
      summary.content_hash,
      summary.content_snapshot
    );
  }
}

/**
 * 保存增量摘要到数据库
 * @param {Object} supplement - 增量摘要对象
 * @returns {Object} 数据库操作结果
 */
export function saveSupplementSummary(supplement) {
  if (!supplement) return { changes: 0 };

  return postSummaryQueries.updateAiSupplement(
    supplement.post_id,
    supplement.supplement_factors,
    supplement.supplement_concepts,
    supplement.supplement_summary,
    supplement.content_hash,
    supplement.content_snapshot
  );
}

/**
 * 智能更新摘要（根据是否有用户编辑决定完整更新或增量更新）
 * @param {number} postId - 帖子ID
 * @param {boolean} forceFullUpdate - 强制完整更新
 * @returns {Object} 更新结果
 */
export async function smartUpdateSummary(postId, forceFullUpdate = false) {
  const hasUserEdit = postSummaryQueries.hasUserEdit(postId);

  if (hasUserEdit && !forceFullUpdate) {
    // 有用户编辑：生成增量摘要
    const supplement = await generateSupplementSummary(postId);
    if (supplement) {
      saveSupplementSummary(supplement);
      return { type: 'supplement', data: supplement };
    }
    return { type: 'skip', reason: '内容无变化或无新增内容' };
  } else {
    // 无用户编辑或强制更新：完整更新
    const summary = await generatePostSummary(postId, forceFullUpdate);
    if (summary) {
      savePostSummary(summary);
      return { type: 'full', data: summary };
    }
    return { type: 'skip', reason: '内容无变化' };
  }
}

/**
 * 重新生成摘要（强制完整更新，清除用户编辑和AI补充）
 * @param {number} postId - 帖子ID
 * @param {boolean} clearUserEdits - 是否清除用户编辑
 */
export async function regeneratePostSummary(postId, clearUserEdits = false) {
  if (clearUserEdits) {
    postSummaryQueries.clearUserEdit(postId);
  }
  const summary = await generatePostSummary(postId, true);
  savePostSummary(summary);
  return summary;
}

/**
 * 批量智能更新摘要（根据用户编辑情况选择更新方式）
 * @param {boolean} forceFullUpdate - 强制完整更新所有摘要
 * @returns {Object} 统计信息
 */
export async function generateSummariesForExistingPosts(forceFullUpdate = false) {
  let options = {};
  if (typeof forceFullUpdate === 'object' && forceFullUpdate !== null) {
    options = forceFullUpdate;
  } else {
    options = { forceFullUpdate };
  }

  const triggerType = options.triggerType || 'auto';
  const scope = options.scope || 'batch';
  const forceUpdate = !!options.forceFullUpdate;
  const shouldCheckRecent = triggerType === 'auto';
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const formatUtcTimestamp = (date) => date.toISOString().replace('T', ' ').replace('Z', '');
  const db = (await import('./db.js')).getDb();
  const posts = db.prepare(`
    SELECT
      p.id,
      p.title,
      p.updated_at,
      (SELECT MAX(c.created_at) FROM comments c WHERE c.post_id = p.id) as last_comment_at,
      (SELECT MAX(r.created_at) FROM results r WHERE r.post_id = p.id) as last_result_at,
      (SELECT pi.updated_at FROM post_ideas pi WHERE pi.post_id = p.id) as last_idea_at
    FROM posts p
    ORDER BY p.created_at DESC
  `).all();

  let fullUpdateCount = 0;
  let supplementCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const parsed = new Date(`${timestamp}Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  for (const post of posts) {
    const startTime = Date.now();
    const startedAt = formatUtcTimestamp(new Date(startTime));
    const existing = postSummaryQueries.getByPostId(post.id);
    const contentHashBefore = existing?.last_post_hash || null;
    let contentHashAfter = contentHashBefore;

    try {
      if (shouldCheckRecent) {
        const timestamps = [
          parseTimestamp(post.updated_at),
          parseTimestamp(post.last_comment_at),
          parseTimestamp(post.last_result_at),
          parseTimestamp(post.last_idea_at)
        ].filter(Boolean);
        const lastChangeAt = timestamps.length ? new Date(Math.max(...timestamps.map(ts => ts.getTime()))) : null;
        if (lastChangeAt && Date.now() - lastChangeAt.getTime() > threeDaysMs) {
          skippedCount++;
          summaryLogQueries.create({
            triggerType,
            scope,
            postId: post.id,
            summaryType: 'skip',
            status: 'skipped',
            note: '近3天无内容变化，跳过',
            startedAt,
            finishedAt: formatUtcTimestamp(new Date()),
            durationSec: (Date.now() - startTime) / 1000,
            contentHashBefore,
            contentHashAfter
          });
          continue;
        }
      }
      // 不再检查OCR状态，getPostContent会自动合并所有可用内容
      const result = await smartUpdateSummary(post.id, forceUpdate);
      if (result.type === 'full') {
        fullUpdateCount++;
        contentHashAfter = result.data?.content_hash || contentHashAfter;
        summaryLogQueries.create({
          triggerType,
          scope,
          postId: post.id,
          summaryType: 'full',
          status: 'success',
          note: '完整摘要更新',
          startedAt,
          finishedAt: formatUtcTimestamp(new Date()),
          durationSec: (Date.now() - startTime) / 1000,
          contentHashBefore,
          contentHashAfter
        });
      } else if (result.type === 'supplement') {
        supplementCount++;
        contentHashAfter = result.data?.content_hash || contentHashAfter;
        summaryLogQueries.create({
          triggerType,
          scope,
          postId: post.id,
          summaryType: 'supplement',
          status: 'success',
          note: '增量补充摘要',
          startedAt,
          finishedAt: formatUtcTimestamp(new Date()),
          durationSec: (Date.now() - startTime) / 1000,
          contentHashBefore,
          contentHashAfter
        });
      } else {
        skippedCount++;
        summaryLogQueries.create({
          triggerType,
          scope,
          postId: post.id,
          summaryType: 'skip',
          status: 'skipped',
          note: result.reason || '内容未变化，跳过',
          startedAt,
          finishedAt: formatUtcTimestamp(new Date()),
          durationSec: (Date.now() - startTime) / 1000,
          contentHashBefore,
          contentHashAfter
        });
      }

      if (posts.indexOf(post) < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failCount++;
      summaryLogQueries.create({
        triggerType,
        scope,
        postId: post.id,
        summaryType: 'failed',
        status: 'failed',
        note: error?.message || '摘要更新失败',
        startedAt,
        finishedAt: formatUtcTimestamp(new Date()),
        durationSec: (Date.now() - startTime) / 1000,
        contentHashBefore,
        contentHashAfter
      });
    }
  }

  return {
    total: posts.length,
    fullUpdate: fullUpdateCount,
    supplement: supplementCount,
    skipped: skippedCount,
    fail: failCount
  };
}
