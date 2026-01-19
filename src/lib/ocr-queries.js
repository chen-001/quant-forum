import { getDb } from './db';
import { ocrQueue } from './ocr-queue';

const IMAGE_PATTERN = /!\[.*?\]\((\/uploads\/[^)]+)\)/g;

function extractImages(content) {
    const images = [];
    let match;
    while ((match = IMAGE_PATTERN.exec(content)) !== null) {
        images.push(match[1]);
    }
    return images;
}

export const ocrTextQueries = {
    // 帖子纯文字版
    getPostText: (postId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM posts_text WHERE post_id = ?');
        return stmt.get(postId);
    },

    upsertPostText: (postId, content) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO posts_text (post_id, content, ocr_status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(post_id) DO UPDATE SET
                content = excluded.content,
                ocr_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(postId, content);
    },

    // 评论纯文字版
    getCommentText: (commentId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM comments_text WHERE comment_id = ?');
        return stmt.get(commentId);
    },

    upsertCommentText: (commentId, content) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO comments_text (comment_id, content, ocr_status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(comment_id) DO UPDATE SET
                content = excluded.content,
                ocr_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(commentId, content);
    },

    // 成果纯文字版
    getResultText: (resultId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM results_text WHERE result_id = ?');
        return stmt.get(resultId);
    },

    upsertResultText: (resultId, content) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO results_text (result_id, content, ocr_status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(result_id) DO UPDATE SET
                content = excluded.content,
                ocr_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(resultId, content);
    },

    // 想法区纯文字版
    getIdeaText: (ideaId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM post_ideas_text WHERE idea_id = ?');
        return stmt.get(ideaId);
    },

    upsertIdeaText: (ideaId, content) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO post_ideas_text (idea_id, content, ocr_status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(idea_id) DO UPDATE SET
                content = excluded.content,
                ocr_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(ideaId, content);
    },

    // 待办纯文字版
    getTodoText: (todoId) => {
        const db = getDb();
        const stmt = db.prepare('SELECT * FROM todos_text WHERE todo_id = ?');
        return stmt.get(todoId);
    },

    upsertTodoText: (todoId, content) => {
        const db = getDb();
        const stmt = db.prepare(`
            INSERT INTO todos_text (todo_id, content, ocr_status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(todo_id) DO UPDATE SET
                content = excluded.content,
                ocr_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(todoId, content);
    },

    // OCR队列管理
    scheduleOCR: (taskType, targetId, content) => {
        const db = getDb();
        const images = extractImages(content);

        for (const imageUrl of images) {
            ocrQueue.addTask(db, taskType, targetId, imageUrl);
        }

        return images.length;
    },

    // 批量获取纯文字内容
    getPostsWithText: (postIds) => {
        const db = getDb();
        const placeholders = postIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT p.*, pt.content as text_content, pt.ocr_status
            FROM posts p
            LEFT JOIN posts_text pt ON p.id = pt.post_id
            WHERE p.id IN (${placeholders})
        `);
        return stmt.all(...postIds);
    },

    getCommentsWithText: (commentIds) => {
        const db = getDb();
        const placeholders = commentIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT c.*, ct.content as text_content, ct.ocr_status
            FROM comments c
            LEFT JOIN comments_text ct ON c.id = ct.comment_id
            WHERE c.id IN (${placeholders})
        `);
        return stmt.all(...commentIds);
    }
};
