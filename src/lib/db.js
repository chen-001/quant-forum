import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

let db = null;

export function getDb() {
    if (!db) {
        // Use import.meta.url to get the current file's path and resolve data/forum.db relative to it
        // src/lib/db.js -> ../../data/forum.db
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const dbPath = path.join(__dirname, '../../data/forum.db');

        console.log('Database path:', dbPath);

        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

// 用户相关操作
export const userQueries = {
    create: (username, passwordHash) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        return stmt.run(username, passwordHash);
    },

    findByUsername: (username) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    },

    findById: (id) => {
        const db = getDb();
        const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
        return stmt.get(id);
    }
};

// 帖子相关操作
export const postQueries = {
    create: (title, content, authorId) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)');
        return stmt.run(title, content, authorId);
    },

    addLink: (postId, url, title, orderNum) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO post_links (post_id, url, title, order_num) VALUES (?, ?, ?, ?)');
        return stmt.run(postId, url, title, orderNum);
    },

    findById: (id) => {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT p.*, u.username as author_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `);
        return stmt.get(id);
    },

    getLinks: (postId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM post_links WHERE post_id = ? ORDER BY order_num');
        return stmt.all(postId);
    },

    list: (orderBy = 'created_at', order = 'DESC', limit = 50, offset = 0) => {
        const db = getDb();
        const validOrderBy = ['created_at', 'updated_at', 'avg_novelty', 'avg_test_effect',
            'avg_extensibility', 'avg_creativity', 'avg_fun', 'avg_completeness', 'avg_total'];
        const orderColumn = validOrderBy.includes(orderBy) ? orderBy : 'created_at';
        const orderDirection = order === 'ASC' ? 'ASC' : 'DESC';

        const stmt = db.prepare(`
      SELECT 
        p.*,
        u.username as author_name,
        (SELECT COUNT(*) FROM post_links WHERE post_id = p.id) as link_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        COALESCE((SELECT AVG(novelty) FROM ratings WHERE post_id = p.id), 0) as avg_novelty,
        COALESCE((SELECT AVG(test_effect) FROM ratings WHERE post_id = p.id), 0) as avg_test_effect,
        COALESCE((SELECT AVG(extensibility) FROM ratings WHERE post_id = p.id), 0) as avg_extensibility,
        COALESCE((SELECT AVG(creativity) FROM ratings WHERE post_id = p.id), 0) as avg_creativity,
        COALESCE((SELECT AVG(fun) FROM ratings WHERE post_id = p.id), 0) as avg_fun,
        COALESCE((SELECT AVG(completeness) FROM ratings WHERE post_id = p.id), 0) as avg_completeness,
        COALESCE((SELECT AVG((novelty + test_effect + extensibility + creativity + fun + completeness) / 6.0) FROM ratings WHERE post_id = p.id), 0) as avg_total
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.is_pinned DESC, ${orderColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `);
        return stmt.all(limit, offset);
    },

    search: (keyword, orderBy = 'created_at', order = 'DESC', limit = 50, offset = 0) => {
        const db = getDb();
        const validOrderBy = ['created_at', 'updated_at', 'avg_novelty', 'avg_test_effect',
            'avg_extensibility', 'avg_creativity', 'avg_fun', 'avg_completeness', 'avg_total'];
        const orderColumn = validOrderBy.includes(orderBy) ? orderBy : 'created_at';
        const orderDirection = order === 'ASC' ? 'ASC' : 'DESC';

        const searchPattern = `%${keyword}%`;

        const stmt = db.prepare(`
      SELECT DISTINCT
        p.*,
        u.username as author_name,
        (SELECT COUNT(*) FROM post_links WHERE post_id = p.id) as link_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        COALESCE((SELECT AVG(novelty) FROM ratings WHERE post_id = p.id), 0) as avg_novelty,
        COALESCE((SELECT AVG(test_effect) FROM ratings WHERE post_id = p.id), 0) as avg_test_effect,
        COALESCE((SELECT AVG(extensibility) FROM ratings WHERE post_id = p.id), 0) as avg_extensibility,
        COALESCE((SELECT AVG(creativity) FROM ratings WHERE post_id = p.id), 0) as avg_creativity,
        COALESCE((SELECT AVG(fun) FROM ratings WHERE post_id = p.id), 0) as avg_fun,
        COALESCE((SELECT AVG(completeness) FROM ratings WHERE post_id = p.id), 0) as avg_completeness,
        COALESCE((SELECT AVG((novelty + test_effect + extensibility + creativity + fun + completeness) / 6.0) FROM ratings WHERE post_id = p.id), 0) as avg_total
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN comments c ON c.post_id = p.id
      LEFT JOIN results r ON r.post_id = p.id
      LEFT JOIN post_ideas pi ON pi.post_id = p.id
      WHERE 
        p.title LIKE ? OR
        p.content LIKE ? OR
        u.username LIKE ? OR
        c.content LIKE ? OR
        r.content LIKE ? OR
        pi.content LIKE ?
      ORDER BY p.is_pinned DESC, ${orderColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `);
        return stmt.all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit, offset);
    },

    updateTime: (id) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE posts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(id);
    },

    update: (id, title, content) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(title, content, id);
    },

    deleteLinks: (postId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM post_links WHERE post_id = ?');
        return stmt.run(postId);
    },

    delete: (postId) => {
        const db = getDb();
        // 由于外键约束，需要先删除关联数据
        db.prepare('DELETE FROM post_links WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM post_table_data WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)').run(postId);
        db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM ratings WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM results WHERE post_id = ?').run(postId);
        const stmt = db.prepare('DELETE FROM posts WHERE id = ?');
        return stmt.run(postId);
    },

    togglePin: (postId, isPinned) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?');
        return stmt.run(isPinned ? 1 : 0, postId);
    },

    // 表格帖子相关操作
    createTablePost: (title, content, authorId, tableData, columnWidths, rowHeights) => {
        const db = getDb();
        const postStmt = db.prepare('INSERT INTO posts (title, content, author_id, post_type) VALUES (?, ?, ?, ?)');
        const result = postStmt.run(title, content, authorId, 'table');
        const postId = result.lastInsertRowid;

        const tableStmt = db.prepare('INSERT INTO post_table_data (post_id, table_data, column_widths, row_heights) VALUES (?, ?, ?, ?)');
        tableStmt.run(postId, JSON.stringify(tableData), JSON.stringify(columnWidths || []), JSON.stringify(rowHeights || []));

        return result;
    },

    getTableData: (postId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM post_table_data WHERE post_id = ?');
        const row = stmt.get(postId);
        if (row) {
            return {
                ...row,
                table_data: JSON.parse(row.table_data),
                column_widths: row.column_widths ? JSON.parse(row.column_widths) : [],
                row_heights: row.row_heights ? JSON.parse(row.row_heights) : []
            };
        }
        return null;
    },

    saveTableData: (postId, tableData, columnWidths, rowHeights) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO post_table_data (post_id, table_data, column_widths, row_heights) VALUES (?, ?, ?, ?)');
        return stmt.run(postId, JSON.stringify(tableData), JSON.stringify(columnWidths || []), JSON.stringify(rowHeights || []));
    },

    updateTableData: (postId, tableData, columnWidths, rowHeights) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE post_table_data SET table_data = ?, column_widths = ?, row_heights = ? WHERE post_id = ?');
        return stmt.run(JSON.stringify(tableData), JSON.stringify(columnWidths || []), JSON.stringify(rowHeights || []), postId);
    }
};

// 评论相关操作
export const commentQueries = {
    create: (postId, authorId, content, parentId = null, category = 'free') => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO comments (post_id, author_id, content, parent_id, category) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(postId, authorId, content, parentId, category);
        postQueries.updateTime(postId);
        return result;
    },

    findByPostId: (postId) => {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT c.*, u.username as author_name
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `);
        return stmt.all(postId);
    },

    addReaction: (commentId, userId, reactionType) => {
        const db = getDb();
        const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO comment_reactions (comment_id, user_id, reaction_type)
      VALUES (?, ?, ?)
    `);
        const result = insertStmt.run(commentId, userId, reactionType);

        if (result.changes > 0) {
            const updateStmt = db.prepare(`
        UPDATE comments SET ${reactionType === 'like' ? 'likes_count' : 'doubts_count'} = 
        ${reactionType === 'like' ? 'likes_count' : 'doubts_count'} + 1
        WHERE id = ?
      `);
            updateStmt.run(commentId);
        }
        return result;
    },

    removeReaction: (commentId, userId, reactionType) => {
        const db = getDb();
        const deleteStmt = db.prepare(`
      DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction_type = ?
    `);
        const result = deleteStmt.run(commentId, userId, reactionType);

        if (result.changes > 0) {
            const updateStmt = db.prepare(`
        UPDATE comments SET ${reactionType === 'like' ? 'likes_count' : 'doubts_count'} = 
        MAX(0, ${reactionType === 'like' ? 'likes_count' : 'doubts_count'} - 1)
        WHERE id = ?
      `);
            updateStmt.run(commentId);
        }
        return result;
    },

    getUserReactions: (postId, userId) => {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT cr.comment_id, cr.reaction_type
      FROM comment_reactions cr
      JOIN comments c ON cr.comment_id = c.id
      WHERE c.post_id = ? AND cr.user_id = ?
    `);
        return stmt.all(postId, userId);
    },

    findById: (id) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT c.*, u.username as author_name
            FROM comments c
            JOIN users u ON c.author_id = u.id
            WHERE c.id = ?
        `);
        return stmt.get(id);
    },

    update: (id, authorId, content) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE comments SET content = ? WHERE id = ? AND author_id = ?');
        return stmt.run(content, id, authorId);
    },

    delete: (id, authorId) => {
        const db = getDb();
        // First delete reactions for this comment
        db.prepare('DELETE FROM comment_reactions WHERE comment_id = ?').run(id);
        // Then delete the comment (only if author matches)
        const stmt = db.prepare('DELETE FROM comments WHERE id = ? AND author_id = ?');
        return stmt.run(id, authorId);
    }
};

// 成果记录相关操作
export const resultQueries = {
    create: (postId, authorId, content) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO results (post_id, author_id, content) VALUES (?, ?, ?)');
        const result = stmt.run(postId, authorId, content);
        postQueries.updateTime(postId);
        return result;
    },

    findByPostId: (postId) => {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT r.*, u.username as author_name
      FROM results r
      JOIN users u ON r.author_id = u.id
      WHERE r.post_id = ?
      ORDER BY r.created_at DESC
    `);
        return stmt.all(postId);
    }
};

// 评分相关操作
export const ratingQueries = {
    upsert: (postId, userId, ratings) => {
        const db = getDb();
        const stmt = db.prepare(`
      INSERT INTO ratings (post_id, user_id, novelty, test_effect, extensibility, creativity, fun, completeness)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(post_id, user_id) DO UPDATE SET
        novelty = excluded.novelty,
        test_effect = excluded.test_effect,
        extensibility = excluded.extensibility,
        creativity = excluded.creativity,
        fun = excluded.fun,
        completeness = excluded.completeness
    `);
        // 将0值转换为null，这样不会影响平均值计算
        const toNullIfZero = (v) => (v && v > 0) ? v : null;
        return stmt.run(postId, userId,
            toNullIfZero(ratings.novelty),
            toNullIfZero(ratings.test_effect),
            toNullIfZero(ratings.extensibility),
            toNullIfZero(ratings.creativity),
            toNullIfZero(ratings.fun),
            toNullIfZero(ratings.completeness));
    },

    getAverages: (postId) => {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT 
        COALESCE(AVG(novelty), 0) as avg_novelty,
        COALESCE(AVG(test_effect), 0) as avg_test_effect,
        COALESCE(AVG(extensibility), 0) as avg_extensibility,
        COALESCE(AVG(creativity), 0) as avg_creativity,
        COALESCE(AVG(fun), 0) as avg_fun,
        COALESCE(AVG(completeness), 0) as avg_completeness,
        COUNT(*) as rating_count
      FROM ratings WHERE post_id = ?
    `);
        return stmt.get(postId);
    },

    getUserRating: (postId, userId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM ratings WHERE post_id = ? AND user_id = ?');
        return stmt.get(postId, userId);
    }
};

// 行级评论相关操作
export const lineCommentQueries = {
    create: (postId, lineIndex, authorId, content) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO line_comments (post_id, line_index, author_id, content) VALUES (?, ?, ?, ?)');
        const result = stmt.run(postId, lineIndex, authorId, content);
        postQueries.updateTime(postId);
        return result;
    },

    findByPostId: (postId) => {
        const db = getDb();
        const stmt = db.prepare(`
      SELECT lc.*, u.username as author_name
      FROM line_comments lc
      JOIN users u ON lc.author_id = u.id
      WHERE lc.post_id = ?
      ORDER BY lc.line_index, lc.created_at ASC
    `);
        return stmt.all(postId);
    },

    delete: (id, authorId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM line_comments WHERE id = ? AND author_id = ?');
        return stmt.run(id, authorId);
    }
};

// 文字高亮相关操作
export const highlightQueries = {
    create: (postId, userId, lineIndex, startOffset, endOffset, color) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO highlights (post_id, user_id, line_index, start_offset, end_offset, color) VALUES (?, ?, ?, ?, ?, ?)');
        return stmt.run(postId, userId, lineIndex, startOffset, endOffset, color);
    },

    findByPostIdAndUser: (postId, userId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM highlights WHERE post_id = ? AND user_id = ? ORDER BY line_index, start_offset');
        return stmt.all(postId, userId);
    },

    findByPostId: (postId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM highlights WHERE post_id = ? ORDER BY line_index, start_offset');
        return stmt.all(postId);
    },

    delete: (id, userId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM highlights WHERE id = ? AND user_id = ?');
        return stmt.run(id, userId);
    }
};

// 帖子想法区相关操作
export const ideaQueries = {
    get: (postId) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT pi.*, u.username as last_editor_name
            FROM post_ideas pi
            LEFT JOIN users u ON pi.last_editor_id = u.id
            WHERE pi.post_id = ?
        `);
        return stmt.get(postId);
    },

    upsert: (postId, content, editorId) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO post_ideas (post_id, content, last_editor_id, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(post_id) DO UPDATE SET
                content = excluded.content,
                last_editor_id = excluded.last_editor_id,
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(postId, content, editorId);
    }
};

// 收藏相关操作
export const favoriteQueries = {
    create: ({ userId, contentType, postId, commentId, resultId, textData, imageUrl, lineIndex, startOffset, endOffset, visibility = 'public' }) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO favorites (
                user_id, content_type, content_id, post_id, comment_id, result_id,
                text_data, image_url, line_index, start_offset, end_offset, visibility
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, contentType, commentId || resultId || postId, postId, commentId, resultId, textData, imageUrl, lineIndex, startOffset, endOffset, visibility);
    },

    findByUserId: (userId, contentType = null, postId = null, scope = 'mine') => {
        const db = getDb();
        let query = `
            SELECT f.*,
                p.title as post_title,
                p.author_id as post_author_id,
                u.username as post_author_name,
                c.content as comment_content,
                c.author_id as comment_author_id,
                cu.username as comment_author_name,
                r.content as result_content,
                r.author_id as result_author_id,
                ru.username as result_author_name,
                fu.username as favorite_author_name,
                fu.id as favorite_author_id
            FROM favorites f
            JOIN posts p ON f.post_id = p.id
            JOIN users u ON p.author_id = u.id
            LEFT JOIN comments c ON f.comment_id = c.id
            LEFT JOIN users cu ON c.author_id = cu.id
            LEFT JOIN results r ON f.result_id = r.id
            LEFT JOIN users ru ON r.author_id = ru.id
            LEFT JOIN users fu ON f.user_id = fu.id
            WHERE 1=1
        `;

        const params = [];

        // 根据 scope 参数决定查询范围
        if (scope === 'mine') {
            query += ' AND f.user_id = ?';
            params.push(userId);
        } else if (scope === 'all') {
            // 查询所有公开的收藏 + 当前用户的所有收藏
            query += ' AND (f.visibility = \'public\' OR f.user_id = ?)';
            params.push(userId);
        }

        if (contentType) {
            query += ' AND f.content_type = ?';
            params.push(contentType);
        }

        if (postId) {
            query += ' AND f.post_id = ?';
            params.push(postId);
        }

        query += ' ORDER BY f.created_at DESC';

        const stmt = db.prepare(query);
        return stmt.all(...params);
    },

    findById: (id) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM favorites WHERE id = ?');
        return stmt.get(id);
    },

    delete: (id, userId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');
        return stmt.run(id, userId);
    },

    updateVisibility: (id, userId, visibility) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE favorites SET visibility = ? WHERE id = ? AND user_id = ?');
        return stmt.run(visibility, id, userId);
    },

    checkIfExists: ({ userId, contentType, postId, commentId, resultId }) => {
        const db = getDb();
        let query = 'SELECT id FROM favorites WHERE user_id = ? AND content_type = ? AND post_id = ?';
        let params = [userId, contentType, postId];

        if (commentId) {
            query += ' AND comment_id = ?';
            params.push(commentId);
        }

        if (resultId) {
            query += ' AND result_id = ?';
            params.push(resultId);
        }

        const stmt = db.prepare(query);
        const result = stmt.get(...params);
        return !!result;
    }
};

// 待办相关操作
export const todoQueries = {
    create: ({ userId, contentType, postId, commentId, resultId, textData, imageUrl, lineIndex, startOffset, endOffset, note, visibility = 'public' }) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO todos (
                user_id, content_type, content_id, post_id, comment_id, result_id,
                text_data, image_url, line_index, start_offset, end_offset, note, visibility
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, contentType, commentId || resultId || postId, postId, commentId, resultId, textData, imageUrl, lineIndex, startOffset, endOffset, note, visibility);
    },

    findByUserId: (userId, contentType = null, postId = null, isCompleted = null, scope = 'mine') => {
        const db = getDb();
        let query = `
            SELECT t.*,
                p.title as post_title,
                p.author_id as post_author_id,
                u.username as post_author_name,
                c.content as comment_content,
                c.author_id as comment_author_id,
                cu.username as comment_author_name,
                r.content as result_content,
                r.author_id as result_author_id,
                ru.username as result_author_name,
                tu.username as todo_author_name,
                tu.id as todo_author_id
            FROM todos t
            JOIN posts p ON t.post_id = p.id
            JOIN users u ON p.author_id = u.id
            LEFT JOIN comments c ON t.comment_id = c.id
            LEFT JOIN users cu ON c.author_id = cu.id
            LEFT JOIN results r ON t.result_id = r.id
            LEFT JOIN users ru ON r.author_id = ru.id
            LEFT JOIN users tu ON t.user_id = tu.id
            WHERE 1=1
        `;

        const params = [];

        // 根据 scope 参数决定查询范围
        if (scope === 'mine') {
            query += ' AND t.user_id = ?';
            params.push(userId);
        } else if (scope === 'all') {
            // 查询所有公开的待办 + 当前用户的所有待办
            query += ' AND (t.visibility = \'public\' OR t.user_id = ?)';
            params.push(userId);
        }

        if (contentType) {
            query += ' AND t.content_type = ?';
            params.push(contentType);
        }

        if (postId) {
            query += ' AND t.post_id = ?';
            params.push(postId);
        }

        if (isCompleted !== null) {
            query += ' AND t.is_completed = ?';
            params.push(isCompleted ? 1 : 0);
        }

        query += ' ORDER BY t.is_completed ASC, t.created_at DESC';

        const stmt = db.prepare(query);
        return stmt.all(...params);
    },

    findById: (id) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
        return stmt.get(id);
    },

    delete: (id, userId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');
        return stmt.run(id, userId);
    },

    updateCompleteStatus: (id, isCompleted) => {
        const db = getDb();
        if (isCompleted) {
            const stmt = db.prepare(`
                UPDATE todos
                SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            return stmt.run(id);
        } else {
            const stmt = db.prepare(`
                UPDATE todos
                SET is_completed = 0, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            return stmt.run(id);
        }
    },

    updateNote: (id, note) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE todos SET note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(note, id);
    },

    updateVisibility: (id, userId, visibility) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE todos SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
        return stmt.run(visibility, id, userId);
    },

    checkIfExists: ({ userId, contentType, postId, commentId, resultId }) => {
        const db = getDb();
        let query = 'SELECT id FROM todos WHERE user_id = ? AND content_type = ? AND post_id = ?';
        let params = [userId, contentType, postId];

        if (commentId) {
            query += ' AND comment_id = ?';
            params.push(commentId);
        }

        if (resultId) {
            query += ' AND result_id = ?';
            params.push(resultId);
        }

        const stmt = db.prepare(query);
        const result = stmt.get(...params);
        return !!result;
    }
};
