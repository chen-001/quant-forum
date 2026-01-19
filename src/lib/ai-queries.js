import { getDb } from './db.js';

const db = getDb();

/**
 * AI工具查询层
 * 提供Function Calling工具的数据库查询实现
 */

// ==================== 帖子相关查询 ====================

/**
 * 搜索帖子内容（纯文字版）
 */
export function searchPostsText(keyword, limit = 10) {
  const stmt = db.prepare(`
    SELECT p.id, p.title, p.post_type, p.author_id, u.username as author_name,
           pt.content as text_content, p.created_at
    FROM posts p
    LEFT JOIN posts_text pt ON p.id = pt.post_id
    LEFT JOIN users u ON p.author_id = u.id
    WHERE (p.title LIKE ? OR pt.content LIKE ?)
    ORDER BY p.created_at DESC
    LIMIT ?
  `);
  const pattern = `%${keyword}%`;
  return stmt.all(pattern, pattern, limit);
}

/**
 * 获取帖子详情
 */
export function getPostDetail(postId) {
  const stmt = db.prepare(`
    SELECT p.id, p.title, p.content, p.post_type, p.author_id, u.username as author_name,
           pt.content as text_content, p.created_at, p.updated_at
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN posts_text pt ON p.id = pt.post_id
    WHERE p.id = ?
  `);
  return stmt.get(postId);
}

// ==================== 评论相关查询 ====================

/**
 * 搜索评论内容（纯文字版）
 */
export function searchCommentsText(keyword, postId = null, limit = 10) {
  let query = `
    SELECT c.id, c.post_id, c.content, c.author_id, u.username as author_name,
           ct.content as text_content, c.created_at,
           p.title as post_title
    FROM comments c
    LEFT JOIN comments_text ct ON c.id = ct.comment_id
    LEFT JOIN users u ON c.author_id = u.id
    LEFT JOIN posts p ON c.post_id = p.id
    WHERE ct.content LIKE ?
  `;
  const params = [`%${keyword}%`];

  if (postId !== null) {
    query += ` AND c.post_id = ?`;
    params.push(postId);
  }

  query += ` ORDER BY c.created_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * 获取帖子的所有评论
 */
export function getPostComments(postId, limit = 50) {
  const stmt = db.prepare(`
    SELECT c.id, c.post_id, c.parent_id, c.content, c.author_id,
           u.username as author_name, ct.content as text_content,
           c.likes_count, c.doubts_count, c.created_at
    FROM comments c
    LEFT JOIN users u ON c.author_id = u.id
    LEFT JOIN comments_text ct ON c.id = ct.comment_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    LIMIT ?
  `);
  return stmt.all(postId, limit);
}

// ==================== 成果相关查询 ====================

/**
 * 搜索成果内容（纯文字版）
 */
export function searchResultsText(keyword, postId = null, limit = 10) {
  let query = `
    SELECT r.id, r.post_id, r.content, r.author_id, u.username as author_name,
           rt.content as text_content, r.created_at,
           p.title as post_title
    FROM results r
    LEFT JOIN results_text rt ON r.id = rt.result_id
    LEFT JOIN users u ON r.author_id = u.id
    LEFT JOIN posts p ON r.post_id = p.id
    WHERE rt.content LIKE ?
  `;
  const params = [`%${keyword}%`];

  if (postId !== null) {
    query += ` AND r.post_id = ?`;
    params.push(postId);
  }

  query += ` ORDER BY r.created_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * 获取帖子的所有成果
 */
export function getPostResults(postId, limit = 50) {
  const stmt = db.prepare(`
    SELECT r.id, r.post_id, r.content, r.author_id, u.username as author_name,
           rt.content as text_content, r.created_at
    FROM results r
    LEFT JOIN users u ON r.author_id = u.id
    LEFT JOIN results_text rt ON r.id = rt.result_id
    WHERE r.post_id = ?
    ORDER BY r.created_at ASC
    LIMIT ?
  `);
  return stmt.all(postId, limit);
}

// ==================== 想法区相关查询 ====================

/**
 * 获取帖子想法区内容
 */
export function getPostIdeas(postId) {
  const stmt = db.prepare(`
    SELECT pi.id, pi.post_id, pi.content, pi.updated_at,
           u.username as last_editor_name,
           pit.content as text_content
    FROM post_ideas pi
    LEFT JOIN users u ON pi.last_editor_id = u.id
    LEFT JOIN post_ideas_text pit ON pi.id = pit.idea_id
    WHERE pi.post_id = ?
  `);
  return stmt.get(postId);
}

// ==================== 收藏相关查询 ====================

/**
 * 搜索收藏内容
 */
export function searchFavorites(keyword, userId = null, contentType = null, limit = 10, scope = 'all') {
  let query = `
    SELECT f.id, f.user_id, f.content_type, f.content_id, f.post_id,
           f.text_data, f.image_url, f.visibility, f.created_at,
           u.username as user_name,
           p.title as post_title
    FROM favorites f
    LEFT JOIN users u ON f.user_id = u.id
    LEFT JOIN posts p ON f.post_id = p.id
    WHERE (f.text_data LIKE ? OR p.title LIKE ?)
  `;
  const params = [`%${keyword}%`, `%${keyword}%`];

  if (scope === 'mine' && userId !== null) {
    query += ` AND f.user_id = ?`;
    params.push(userId);
  }

  if (contentType !== null) {
    query += ` AND f.content_type = ?`;
    params.push(contentType);
  }

  query += ` ORDER BY f.created_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// ==================== 待办相关查询 ====================

/**
 * 搜索待办内容
 */
export function searchTodos(keyword, userId = null, contentType = null, isCompleted = null, limit = 10, scope = 'all') {
  let query = `
    SELECT t.id, t.user_id, t.content_type, t.content_id, t.post_id,
           t.text_data, t.image_url, t.note, t.is_completed, t.visibility,
           t.created_at, t.updated_at,
           u.username as user_name,
           p.title as post_title
    FROM todos t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN posts p ON t.post_id = p.id
    WHERE (t.text_data LIKE ? OR t.note LIKE ? OR p.title LIKE ?)
  `;
  const params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];

  if (scope === 'mine' && userId !== null) {
    query += ` AND t.user_id = ?`;
    params.push(userId);
  }

  if (contentType !== null) {
    query += ` AND t.content_type = ?`;
    params.push(contentType);
  }

  if (isCompleted !== null) {
    query += ` AND t.is_completed = ?`;
    params.push(isCompleted ? 1 : 0);
  }

  query += ` ORDER BY t.created_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

// ==================== 通用 SQL 查询（只读，安全限制）====================

/**
 * 执行安全的通用 SQL 查询
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @param {number} maxRows - 最大返回行数（默认 100）
 * @returns {Array} 查询结果
 */
export function executeSqlQuery(sql, params = [], maxRows = 100) {
  // 安全检查：只允许 SELECT 语句
  const trimmedSql = sql.trim().toUpperCase();
  if (!trimmedSql.startsWith('SELECT')) {
    throw new Error('只允许执行 SELECT 查询');
  }

  // 禁止的关键字
  const forbiddenKeywords = [
    'DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER',
    'TRUNCATE', 'GRANT', 'REVOKE', 'ATTACH', 'DETACH'
  ];
  for (const keyword of forbiddenKeywords) {
    if (trimmedSql.includes(keyword)) {
      throw new Error(`禁止在查询中使用 ${keyword}`);
    }
  }

  // 强制添加 LIMIT 限制
  if (!/LIMIT\s+\d+/i.test(sql)) {
    sql = `${sql} LIMIT ${maxRows}`;
  } else {
    // 如果已有 LIMIT，检查是否超过最大值
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch && parseInt(limitMatch[1]) > maxRows) {
      sql = sql.replace(/LIMIT\s+\d+/i, `LIMIT ${maxRows}`);
    }
  }

  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    throw new Error(`SQL 查询失败: ${error.message}`);
  }
}

/**
 * 获取数据库表结构信息
 * @returns {Object} 数据库表结构
 */
export function getDatabaseSchema() {
  const stmt = db.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  return stmt.all();
}

/**
 * 获取表的列信息
 * @param {string} tableName - 表名
 * @returns {Array} 列信息
 */
export function getTableColumns(tableName) {
  const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
  return stmt.all();
}
