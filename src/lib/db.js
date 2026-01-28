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

        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        ensureChatSchema(db);
        ensurePostSummariesSchema(db);
        ensureSummaryLogsSchema(db);
        ensureSchedulerStatusSchema(db);
        ensureActivityLogsSchema(db);
        ensureActivityViewsSchema(db);

        // 启动OCR队列处理
        startOCRQueue();
    }
    return db;
}

function ensureChatSchema(database) {
    try {
        const table = database.prepare(`
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name = 'chat_conversations'
        `).get();
        if (!table) return;

        const columns = database.prepare('PRAGMA table_info(chat_conversations)').all();
        const hasSessionId = columns.some(column => column.name === 'opencode_session_id');
        if (!hasSessionId) {
            database.prepare('ALTER TABLE chat_conversations ADD COLUMN opencode_session_id TEXT').run();
        }
    } catch (error) {
        console.error('ensureChatSchema failed:', error);
    }
}

function ensurePostSummariesSchema(database) {
    try {
        const table = database.prepare(`
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name = 'post_summaries'
        `).get();
        if (!table) {
            database.prepare(`
                CREATE TABLE IF NOT EXISTS post_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL UNIQUE,
                    main_topic TEXT NOT NULL,
                    main_logic TEXT NOT NULL,
                    factors TEXT,
                    key_concepts TEXT,
                    summary TEXT NOT NULL,
                    ai_model TEXT,
                    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
            `).run();
            database.prepare(`CREATE INDEX IF NOT EXISTS idx_post_summaries_main_topic ON post_summaries(main_topic)`).run();
            database.prepare(`CREATE INDEX IF NOT EXISTS idx_post_summaries_key_concepts ON post_summaries(key_concepts)`).run();
        }

        // 添加用户编辑和AI补充字段
        const columns = database.prepare('PRAGMA table_info(post_summaries)').all();
        const columnNames = columns.map(c => c.name);

        // 用户手动编辑的字段
        const userFields = ['user_main_topic', 'user_main_logic', 'user_factors', 'user_key_concepts', 'user_summary'];
        for (const field of userFields) {
            if (!columnNames.includes(field)) {
                database.prepare(`ALTER TABLE post_summaries ADD COLUMN ${field} TEXT`).run();
            }
        }

        // AI对新内容的补充字段
        const supplementFields = ['ai_supplement_factors', 'ai_supplement_concepts', 'ai_supplement_summary'];
        for (const field of supplementFields) {
            if (!columnNames.includes(field)) {
                database.prepare(`ALTER TABLE post_summaries ADD COLUMN ${field} TEXT`).run();
            }
        }

        // 追踪字段
        if (!columnNames.includes('last_post_hash')) {
            database.prepare('ALTER TABLE post_summaries ADD COLUMN last_post_hash TEXT').run();
        }
        if (!columnNames.includes('last_post_content_snapshot')) {
            database.prepare('ALTER TABLE post_summaries ADD COLUMN last_post_content_snapshot TEXT').run();
        }
        if (!columnNames.includes('last_user_edit_at')) {
            database.prepare('ALTER TABLE post_summaries ADD COLUMN last_user_edit_at DATETIME').run();
        }
    } catch (error) {
        console.error('ensurePostSummariesSchema failed:', error);
    }
}

function ensureSummaryLogsSchema(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS summary_generation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trigger_type TEXT NOT NULL,
                scope TEXT NOT NULL,
                post_id INTEGER,
                summary_type TEXT NOT NULL,
                status TEXT NOT NULL,
                note TEXT,
                started_at DATETIME,
                finished_at DATETIME,
                duration_sec REAL,
                content_hash_before TEXT,
                content_hash_after TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
            )
        `).run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_summary_logs_created_at ON summary_generation_logs(created_at)').run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_summary_logs_post_id ON summary_generation_logs(post_id)').run();
    } catch (error) {
        console.error('ensureSummaryLogsSchema failed:', error);
    }
}

function ensureSchedulerStatusSchema(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS scheduler_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_name TEXT NOT NULL UNIQUE,
                last_run_at DATETIME,
                next_run_at DATETIME,
                last_status TEXT,
                last_duration_sec REAL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
    } catch (error) {
        console.error('ensureSchedulerStatusSchema failed:', error);
    }
}

function ensureActivityLogsSchema(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                action TEXT NOT NULL,
                actor_id INTEGER,
                related_user_id INTEGER,
                post_id INTEGER,
                comment_id INTEGER,
                result_id INTEGER,
                todo_id INTEGER,
                favorite_id INTEGER,
                summary_id INTEGER,
                meta TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL,
                FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE SET NULL,
                FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL,
                FOREIGN KEY (favorite_id) REFERENCES favorites(id) ON DELETE SET NULL,
                FOREIGN KEY (summary_id) REFERENCES post_summaries(id) ON DELETE SET NULL
            )
        `).run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)').run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_related_user_id ON activity_logs(related_user_id)').run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs(actor_id)').run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_post_id ON activity_logs(post_id)').run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category)').run();
    } catch (error) {
        console.error('ensureActivityLogsSchema failed:', error);
    }
}

function ensureActivityViewsSchema(database) {
    try {
        database.prepare(`
            CREATE TABLE IF NOT EXISTS activity_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                last_seen_all DATETIME,
                last_seen_related DATETIME,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `).run();
        database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_views_user_id ON activity_views(user_id)').run();
    } catch (error) {
        console.error('ensureActivityViewsSchema failed:', error);
    }
}

// 启动OCR队列处理
async function startOCRQueue() {
    try {
        const { ocrQueue } = await import('./ocr-queue.js');
        ocrQueue.start(db);
    } catch (error) {
        console.error('启动OCR队列失败:', error);
    }
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
        const comment = db.prepare('SELECT post_id FROM comments WHERE id = ? AND author_id = ?').get(id, authorId);
        const stmt = db.prepare('UPDATE comments SET content = ? WHERE id = ? AND author_id = ?');
        const result = stmt.run(content, id, authorId);
        if (result.changes > 0 && comment?.post_id) {
            postQueries.updateTime(comment.post_id);
        }
        return result;
    },

    delete: (id, authorId) => {
        const db = getDb();
        // First delete reactions for this comment
        db.prepare('DELETE FROM comment_reactions WHERE comment_id = ?').run(id);
        // Then delete the comment (only if author matches)
        const stmt = db.prepare('DELETE FROM comments WHERE id = ? AND author_id = ?');
        return stmt.run(id, authorId);
    },

    updateCategory: (id, authorId, category) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE comments SET category = ? WHERE id = ? AND author_id = ?');
        return stmt.run(category, id, authorId);
    },

    updateCategoryRecursive: (id, authorId, category) => {
        const db = getDb();
        const stmt = db.prepare(`
            WITH RECURSIVE comment_tree AS (
                SELECT id FROM comments WHERE id = ?
                UNION ALL
                SELECT c.id FROM comments c
                INNER JOIN comment_tree ct ON c.parent_id = ct.id
            )
            UPDATE comments SET category = ?
            WHERE id IN (SELECT id FROM comment_tree) AND author_id = ?
        `);
        return stmt.run(id, category, authorId);
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
        const result = stmt.run(postId, content, editorId);
        if (result.changes > 0) {
            postQueries.updateTime(postId);
        }
        return result;
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

    findExists: ({ userId, contentType, postId, commentId, resultId }) => {
        const db = getDb();
        let query = 'SELECT * FROM favorites WHERE user_id = ? AND content_type = ? AND post_id = ?';
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
        return stmt.get(...params);
    },

    checkIfExists: ({ userId, contentType, postId, commentId, resultId }) => {
        return !!favoriteQueries.findExists({ userId, contentType, postId, commentId, resultId });
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

    findExists: ({ userId, contentType, postId, commentId, resultId }) => {
        const db = getDb();
        let query = 'SELECT * FROM todos WHERE user_id = ? AND content_type = ? AND post_id = ?';
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
        return stmt.get(...params);
    },

    checkIfExists: ({ userId, contentType, postId, commentId, resultId }) => {
        return !!todoQueries.findExists({ userId, contentType, postId, commentId, resultId });
    },

    transfer: (todoId, targetUserId, originalUserId) => {
        const db = getDb();
        const stmt = db.prepare(`
            UPDATE todos
            SET user_id = ?,
                transferred_from = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `);
        return stmt.run(targetUserId, originalUserId, todoId, originalUserId);
    }
};

// AI聊天相关操作
export const chatQueries = {
    // 创建对话
    createConversation: (userId, pageType, contextId = null, title = null, opencodeSessionId = null) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO chat_conversations (user_id, page_type, context_id, title, opencode_session_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, pageType, contextId, title, opencodeSessionId);
    },

    // 获取用户的所有对话
    findConversationsByUserId: (userId) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT c.*, COUNT(m.id) as message_count
            FROM chat_conversations c
            LEFT JOIN chat_messages m ON c.id = m.conversation_id
            WHERE c.user_id = ?
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        `);
        return stmt.all(userId);
    },

    // 获取对话详情
    findConversationById: (conversationId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM chat_conversations WHERE id = ?');
        return stmt.get(conversationId);
    },

    // 更新对话标题
    updateConversationTitle: (conversationId, title) => {
        const db = getDb();
        const stmt = db.prepare(`
            UPDATE chat_conversations
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(title, conversationId);
    },

    // 更新OpenCode会话ID
    updateConversationSession: (conversationId, sessionId) => {
        const db = getDb();
        const stmt = db.prepare(`
            UPDATE chat_conversations
            SET opencode_session_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(sessionId, conversationId);
    },

    // 更新对话时间
    updateConversationTime: (conversationId) => {
        const db = getDb();
        const stmt = db.prepare('UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(conversationId);
    },

    // 删除对话
    deleteConversation: (conversationId, userId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM chat_conversations WHERE id = ? AND user_id = ?');
        return stmt.run(conversationId, userId);
    },

    // 添加消息
    addMessage: (conversationId, role, content, toolCalls = null) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO chat_messages (conversation_id, role, content, tool_calls)
            VALUES (?, ?, ?, ?)
        `);
        const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;
        return stmt.run(conversationId, role, content, toolCallsJson);
    },

    // 获取对话的所有消息
    findMessagesByConversationId: (conversationId) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT * FROM chat_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        `);
        const messages = stmt.all(conversationId);
        // 解析 tool_calls JSON
        return messages.map(msg => ({
            ...msg,
            tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
        }));
    },

    // 获取对话的最后N条消息
    findRecentMessagesByConversationId: (conversationId, limit = 50) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT * FROM chat_messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);
        const messages = stmt.all(conversationId, limit).reverse();
        return messages.map(msg => ({
            ...msg,
            tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
        }));
    },

    // 删除消息
    deleteMessages: (conversationId) => {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?');
        return stmt.run(conversationId);
    }
};

// 帖子摘要相关操作
export const postSummaryQueries = {
    // 创建摘要
    create: (postId, mainTopic, mainLogic, factors, keyConcepts, summary, aiModel) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO post_summaries (post_id, main_topic, main_logic, factors, key_concepts, summary, ai_model)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(postId, mainTopic, mainLogic, factors, keyConcepts, summary, aiModel);
    },

    // 更新摘要
    update: (postId, mainTopic, mainLogic, factors, keyConcepts, summary) => {
        const db = getDb();
        const stmt = db.prepare(`
            UPDATE post_summaries
            SET main_topic = ?, main_logic = ?, factors = ?, key_concepts = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
            WHERE post_id = ?
        `);
        return stmt.run(mainTopic, mainLogic, factors, keyConcepts, summary, postId);
    },

    // 更新AI摘要并记录哈希和快照
    updateWithHash: (postId, mainTopic, mainLogic, factors, keyConcepts, summary, postHash, contentSnapshot) => {
        const db = getDb();
        const stmt = db.prepare(`
            UPDATE post_summaries
            SET main_topic = ?, main_logic = ?, factors = ?, key_concepts = ?, summary = ?,
                last_post_hash = ?, last_post_content_snapshot = ?, updated_at = CURRENT_TIMESTAMP
            WHERE post_id = ?
        `);
        return stmt.run(mainTopic, mainLogic, factors, keyConcepts, summary, postHash, contentSnapshot, postId);
    },

    // 创建摘要并记录哈希和快照
    createWithHash: (postId, mainTopic, mainLogic, factors, keyConcepts, summary, aiModel, postHash, contentSnapshot) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO post_summaries (post_id, main_topic, main_logic, factors, key_concepts, summary, ai_model, last_post_hash, last_post_content_snapshot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(postId, mainTopic, mainLogic, factors, keyConcepts, summary, aiModel, postHash, contentSnapshot);
    },

    // 更新用户编辑的字段
    updateUserEdit: (postId, field, value) => {
        const db = getDb();
        const validFields = ['user_main_topic', 'user_main_logic', 'user_factors', 'user_key_concepts', 'user_summary'];
        if (!validFields.includes(field)) {
            throw new Error('Invalid field name');
        }
        const stmt = db.prepare(`
            UPDATE post_summaries
            SET ${field} = ?, last_user_edit_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE post_id = ?
        `);
        return stmt.run(value, postId);
    },

    // 批量更新用户编辑
    updateUserEditBatch: (postId, updates) => {
        const db = getDb();
        const validFields = ['user_main_topic', 'user_main_logic', 'user_factors', 'user_key_concepts', 'user_summary'];
        const setClauses = [];
        const values = [];
        for (const [field, value] of Object.entries(updates)) {
            if (validFields.includes(field)) {
                setClauses.push(`${field} = ?`);
                values.push(value);
            }
        }
        if (setClauses.length === 0) return { changes: 0 };
        values.push(postId);
        const stmt = db.prepare(`
            UPDATE post_summaries
            SET ${setClauses.join(', ')}, last_user_edit_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE post_id = ?
        `);
        return stmt.run(...values);
    },

    // 清除用户编辑（恢复AI内容）
    clearUserEdit: (postId, field = null) => {
        const db = getDb();
        if (field) {
            const validFields = ['user_main_topic', 'user_main_logic', 'user_factors', 'user_key_concepts', 'user_summary'];
            if (!validFields.includes(field)) {
                throw new Error('Invalid field name');
            }
            // 清除单个字段时，同时清除对应的AI补充
            const supplementMap = {
                'user_factors': 'ai_supplement_factors',
                'user_key_concepts': 'ai_supplement_concepts',
                'user_summary': 'ai_supplement_summary'
            };
            const supplement = supplementMap[field];
            if (supplement) {
                const stmt = db.prepare(`
                    UPDATE post_summaries
                    SET ${field} = NULL, ${supplement} = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE post_id = ?
                `);
                return stmt.run(postId);
            } else {
                const stmt = db.prepare(`
                    UPDATE post_summaries
                    SET ${field} = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE post_id = ?
                `);
                return stmt.run(postId);
            }
        } else {
            // 清除所有用户编辑和AI补充
            const stmt = db.prepare(`
                UPDATE post_summaries
                SET user_main_topic = NULL, user_main_logic = NULL, user_factors = NULL,
                    user_key_concepts = NULL, user_summary = NULL,
                    ai_supplement_factors = NULL, ai_supplement_concepts = NULL, ai_supplement_summary = NULL,
                    last_user_edit_at = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE post_id = ?
            `);
            return stmt.run(postId);
        }
    },

    // 更新AI补充内容
    updateAiSupplement: (postId, supplementFactors, supplementConcepts, supplementSummary, postHash, contentSnapshot) => {
        const db = getDb();
        const stmt = db.prepare(`
            UPDATE post_summaries
            SET ai_supplement_factors = ?, ai_supplement_concepts = ?, ai_supplement_summary = ?,
                last_post_hash = ?, last_post_content_snapshot = ?, updated_at = CURRENT_TIMESTAMP
            WHERE post_id = ?
        `);
        return stmt.run(supplementFactors, supplementConcepts, supplementSummary, postHash, contentSnapshot, postId);
    },

    // 获取合并后的有效摘要（user优先）
    getEffective: (postId) => {
        const db = getDb();
        const raw = db.prepare('SELECT * FROM post_summaries WHERE post_id = ?').get(postId);
        if (!raw) return null;

        // 计算有效值：用户编辑 + AI补充 > AI原始
        const effective = {
            ...raw,
            effective_main_topic: raw.user_main_topic ?? raw.main_topic,
            effective_main_logic: raw.user_main_logic ?? raw.main_logic,
            effective_factors: raw.user_factors ?? raw.factors,
            effective_key_concepts: raw.user_key_concepts ?? raw.key_concepts,
            effective_summary: raw.user_summary ?? raw.summary,
            // AI补充信息
            has_user_edit: raw.user_main_topic !== null || raw.user_main_logic !== null || raw.user_factors !== null ||
                raw.user_key_concepts !== null || raw.user_summary !== null,
            has_supplement: raw.ai_supplement_factors !== null || raw.ai_supplement_concepts !== null || raw.ai_supplement_summary !== null
        };

        return effective;
    },

    // 获取摘要
    getByPostId: (postId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM post_summaries WHERE post_id = ?');
        return stmt.get(postId);
    },

    // 获取所有摘要（包含有效值计算）
    getAll: () => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT
                ps.*,
                p.title as post_title,
                p.author_id,
                u.username as author_name
            FROM post_summaries ps
            JOIN posts p ON p.id = ps.post_id
            LEFT JOIN users u ON p.author_id = u.id
            ORDER BY ps.updated_at DESC
        `);
        const rows = stmt.all();
        // 计算每行的有效值
        return rows.map(row => ({
            ...row,
            effective_main_topic: row.user_main_topic ?? row.main_topic,
            effective_main_logic: row.user_main_logic ?? row.main_logic,
            effective_factors: row.user_factors ?? row.factors,
            effective_key_concepts: row.user_key_concepts ?? row.key_concepts,
            effective_summary: row.user_summary ?? row.summary,
            has_user_edit: row.user_main_topic !== null || row.user_main_logic !== null || row.user_factors !== null ||
                row.user_key_concepts !== null || row.user_summary !== null,
            has_supplement: row.ai_supplement_factors !== null || row.ai_supplement_concepts !== null || row.ai_supplement_summary !== null
        }));
    },

    // 搜索摘要（模糊匹配）
    search: (keyword, limit = 10) => {
        const db = getDb();
        const pattern = `%${keyword}%`;
        const stmt = db.prepare(`
            SELECT
                ps.*,
                p.title as post_title,
                p.author_id,
                u.username as author_name
            FROM post_summaries ps
            JOIN posts p ON p.id = ps.post_id
            LEFT JOIN users u ON p.author_id = u.id
            WHERE ps.main_topic LIKE ?
               OR ps.main_logic LIKE ?
               OR ps.key_concepts LIKE ?
               OR ps.summary LIKE ?
               OR ps.user_main_topic LIKE ?
               OR ps.user_summary LIKE ?
            ORDER BY ps.updated_at DESC
            LIMIT ?
        `);
        const rows = stmt.all(pattern, pattern, pattern, pattern, pattern, pattern, limit);
        return rows.map(row => ({
            ...row,
            effective_main_topic: row.user_main_topic ?? row.main_topic,
            effective_main_logic: row.user_main_logic ?? row.main_logic,
            effective_factors: row.user_factors ?? row.factors,
            effective_key_concepts: row.user_key_concepts ?? row.key_concepts,
            effective_summary: row.user_summary ?? row.summary,
            has_user_edit: row.user_main_topic !== null || row.user_main_logic !== null || row.user_factors !== null ||
                row.user_key_concepts !== null || row.user_summary !== null,
            has_supplement: row.ai_supplement_factors !== null || row.ai_supplement_concepts !== null || row.ai_supplement_summary !== null
        }));
    },

    // 检查是否存在
    exists: (postId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT 1 FROM post_summaries WHERE post_id = ?');
        return stmt.get(postId);
    },

    // 检查是否有用户编辑
    hasUserEdit: (postId) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT 1 FROM post_summaries
            WHERE post_id = ? AND (
                user_main_topic IS NOT NULL OR user_main_logic IS NOT NULL OR
                user_factors IS NOT NULL OR user_key_concepts IS NOT NULL OR user_summary IS NOT NULL
            )
        `);
        return !!stmt.get(postId);
    }
};

export const summaryLogQueries = {
    create: ({
        triggerType,
        scope,
        postId = null,
        summaryType,
        status,
        note = null,
        startedAt = null,
        finishedAt = null,
        durationSec = null,
        contentHashBefore = null,
        contentHashAfter = null
    }) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO summary_generation_logs (
                trigger_type, scope, post_id, summary_type, status, note,
                started_at, finished_at, duration_sec,
                content_hash_before, content_hash_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            triggerType,
            scope,
            postId,
            summaryType,
            status,
            note,
            startedAt,
            finishedAt,
            durationSec,
            contentHashBefore,
            contentHashAfter
        );
    },

    listRecent: (limit = 100) => {
        const db = getDb();
        const stmt = db.prepare(`
            SELECT
                l.*,
                p.title as post_title
            FROM summary_generation_logs l
            LEFT JOIN posts p ON p.id = l.post_id
            ORDER BY l.created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    },

    listPaged: ({ limit = 100, offset = 0, keyword = '' } = {}) => {
        const db = getDb();
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safeOffset = Math.max(offset, 0);
        const hasKeyword = !!keyword && keyword.trim();
        const pattern = hasKeyword ? `%${keyword.trim()}%` : null;

        if (hasKeyword) {
            const stmt = db.prepare(`
                SELECT
                    l.*,
                    p.title as post_title
                FROM summary_generation_logs l
                LEFT JOIN posts p ON p.id = l.post_id
                WHERE p.title LIKE ? OR l.note LIKE ?
                ORDER BY l.created_at DESC
                LIMIT ? OFFSET ?
            `);
            return stmt.all(pattern, pattern, safeLimit, safeOffset);
        }

        const stmt = db.prepare(`
            SELECT
                l.*,
                p.title as post_title
            FROM summary_generation_logs l
            LEFT JOIN posts p ON p.id = l.post_id
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `);
        return stmt.all(safeLimit, safeOffset);
    },

    count: (keyword = '') => {
        const db = getDb();
        const hasKeyword = !!keyword && keyword.trim();
        const pattern = hasKeyword ? `%${keyword.trim()}%` : null;

        if (hasKeyword) {
            const stmt = db.prepare(`
                SELECT COUNT(*) as total
                FROM summary_generation_logs l
                LEFT JOIN posts p ON p.id = l.post_id
                WHERE p.title LIKE ? OR l.note LIKE ?
            `);
            return stmt.get(pattern, pattern)?.total || 0;
        }

        const stmt = db.prepare('SELECT COUNT(*) as total FROM summary_generation_logs');
        return stmt.get()?.total || 0;
    }
};

export const activityLogQueries = {
    create: ({
        category,
        action,
        actorId = null,
        relatedUserId = null,
        postId = null,
        commentId = null,
        resultId = null,
        todoId = null,
        favoriteId = null,
        summaryId = null,
        meta = null
    }) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO activity_logs (
                category, action, actor_id, related_user_id,
                post_id, comment_id, result_id, todo_id, favorite_id, summary_id, meta
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            category,
            action,
            actorId,
            relatedUserId,
            postId,
            commentId,
            resultId,
            todoId,
            favoriteId,
            summaryId,
            meta ? JSON.stringify(meta) : null
        );
    },

    listPaged: ({ scope = 'all', userId = null, limit = 50, offset = 0 } = {}) => {
        const db = getDb();
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const safeOffset = Math.max(offset, 0);
        let whereClause = '';
        const params = [];

        if (scope === 'related' && userId) {
            whereClause = 'WHERE (l.related_user_id = ? OR l.actor_id = ?)';
            params.push(userId, userId);
        }

        const stmt = db.prepare(`
            SELECT
                l.*,
                a.username as actor_name,
                ru.username as related_user_name,
                p.title as post_title,
                c.content as comment_content,
                r.content as result_content,
                ps.main_topic as summary_main_topic
            FROM activity_logs l
            LEFT JOIN users a ON a.id = l.actor_id
            LEFT JOIN users ru ON ru.id = l.related_user_id
            LEFT JOIN posts p ON p.id = l.post_id
            LEFT JOIN comments c ON c.id = l.comment_id
            LEFT JOIN results r ON r.id = l.result_id
            LEFT JOIN post_summaries ps ON ps.id = l.summary_id
            ${whereClause}
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `);
        return stmt.all(...params, safeLimit, safeOffset).map(row => ({
            ...row,
            meta: row.meta ? JSON.parse(row.meta) : null
        }));
    },

    count: ({ scope = 'all', userId = null } = {}) => {
        const db = getDb();
        let whereClause = '';
        const params = [];

        if (scope === 'related' && userId) {
            whereClause = 'WHERE (related_user_id = ? OR actor_id = ?)';
            params.push(userId, userId);
        }

        const stmt = db.prepare(`
            SELECT COUNT(*) as total
            FROM activity_logs
            ${whereClause}
        `);
        return stmt.get(...params)?.total || 0;
    },

    countNew: ({ scope = 'all', userId = null, lastSeenAll = null, lastSeenRelated = null } = {}) => {
        const db = getDb();
        let whereClause = '';
        const params = [];

        if (scope === 'related' && userId) {
            whereClause = 'WHERE (related_user_id = ? OR actor_id = ?)';
            params.push(userId, userId);
            if (lastSeenRelated) {
                whereClause += ' AND created_at > ?';
                params.push(lastSeenRelated);
            }
        } else if (scope === 'all' && lastSeenAll) {
            whereClause = 'WHERE created_at > ?';
            params.push(lastSeenAll);
        }

        const stmt = db.prepare(`
            SELECT COUNT(*) as total
            FROM activity_logs
            ${whereClause}
        `);
        return stmt.get(...params)?.total || 0;
    }
};

export const activityViewQueries = {
    getByUserId: (userId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM activity_views WHERE user_id = ?');
        return stmt.get(userId);
    },

    upsert: ({ userId, lastSeenAll = null, lastSeenRelated = null }) => {
        const db = getDb();
        const existing = activityViewQueries.getByUserId(userId);
        if (!existing) {
            const stmt = db.prepare(`
                INSERT INTO activity_views (user_id, last_seen_all, last_seen_related)
                VALUES (?, ?, ?)
            `);
            return stmt.run(userId, lastSeenAll, lastSeenRelated);
        }

        const stmt = db.prepare(`
            UPDATE activity_views
            SET last_seen_all = COALESCE(?, last_seen_all),
                last_seen_related = COALESCE(?, last_seen_related),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `);
        return stmt.run(lastSeenAll, lastSeenRelated, userId);
    }
};

export const schedulerStatusQueries = {
    get: (jobName) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM scheduler_status WHERE job_name = ?');
        return stmt.get(jobName);
    },

    upsert: (jobName, { lastRunAt = undefined, nextRunAt = null, lastStatus = null, lastDurationSec = null }) => {
        const db = getDb();

        // 如果 lastRunAt 未传递，则从数据库获取当前值
        if (lastRunAt === undefined) {
            const current = db.prepare('SELECT last_run_at FROM scheduler_status WHERE job_name = ?').get(jobName);
            lastRunAt = current?.last_run_at || null;
        }

        const stmt = db.prepare(`
            INSERT INTO scheduler_status (job_name, last_run_at, next_run_at, last_status, last_duration_sec, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(job_name) DO UPDATE SET
                last_run_at = excluded.last_run_at,
                next_run_at = excluded.next_run_at,
                last_status = excluded.last_status,
                last_duration_sec = excluded.last_duration_sec,
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(jobName, lastRunAt, nextRunAt, lastStatus, lastDurationSec);
    }
};
