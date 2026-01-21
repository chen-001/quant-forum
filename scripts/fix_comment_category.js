const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/forum.db');
const db = new Database(dbPath);

// 使用递归CTE修复所有回复的标签，使其与根评论标签一致
const stmt = db.prepare(`
    WITH RECURSIVE comment_tree AS (
        -- 根评论：没有父评论的评论
        SELECT id, category, id as root_id
        FROM comments
        WHERE parent_id IS NULL

        UNION ALL

        -- 递归查找所有回复，并关联到根评论的category
        SELECT c.id, ct.category, ct.root_id
        FROM comments c
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
    )
    UPDATE comments SET category = (
        SELECT ct.category FROM comment_tree ct WHERE ct.id = comments.id
    )
`);

const result = stmt.run();
console.log(`修复完成，影响了 ${result.changes} 条评论`);

db.close();
