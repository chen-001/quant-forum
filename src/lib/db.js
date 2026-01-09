import Database from 'better-sqlite3';
import path from 'path';

let db = null;

export function getDb() {
    if (!db) {
        const dbPath = path.join(process.cwd(), 'data', 'forum.db');
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
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `);
        return stmt.all(limit, offset);
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
    }
};

// 评论相关操作
export const commentQueries = {
    create: (postId, authorId, content, parentId = null) => {
        const db = getDb();
        const stmt = db.prepare('INSERT INTO comments (post_id, author_id, content, parent_id) VALUES (?, ?, ?, ?)');
        const result = stmt.run(postId, authorId, content, parentId);
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
