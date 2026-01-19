const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'forum.db');
const db = new Database(dbPath);

// 创建用户表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 创建帖子表
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    post_type TEXT DEFAULT 'link' CHECK(post_type IN ('link', 'table')),
    author_id INTEGER NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`);

// 检查并添加缺失的列
const addColumnIfNotExists = (table, column, definition) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Added column ${column} to table ${table}`);
  } catch (e) {
    // 列已存在，忽略错误
  }
};

// 迁移：为 posts 表添加列
addColumnIfNotExists('posts', 'post_type', "TEXT DEFAULT 'link' CHECK(post_type IN ('link', 'table'))");
addColumnIfNotExists('posts', 'is_pinned', "INTEGER DEFAULT 0");
addColumnIfNotExists('posts', 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");

// 迁移：为 comments 表添加列
addColumnIfNotExists('comments', 'likes_count', "INTEGER DEFAULT 0");
addColumnIfNotExists('comments', 'doubts_count', "INTEGER DEFAULT 0");
addColumnIfNotExists('comments', 'category', "TEXT DEFAULT 'free'");

// 创建表格帖子数据表
db.exec(`
  CREATE TABLE IF NOT EXISTS post_table_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL UNIQUE,
    table_data TEXT NOT NULL,
    column_widths TEXT,
    row_heights TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`);

// 创建帖子链接表
db.exec(`
  CREATE TABLE IF NOT EXISTS post_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`);

// 创建评论表
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    parent_id INTEGER,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    doubts_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`);

// 创建成果记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`);

// 创建评分表
db.exec(`
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    novelty INTEGER CHECK(novelty BETWEEN 1 AND 5),
    test_effect INTEGER CHECK(test_effect BETWEEN 1 AND 5),
    extensibility INTEGER CHECK(extensibility BETWEEN 1 AND 5),
    creativity INTEGER CHECK(creativity BETWEEN 1 AND 5),
    fun INTEGER CHECK(fun BETWEEN 1 AND 5),
    completeness INTEGER CHECK(completeness BETWEEN 1 AND 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 创建评论互动表
db.exec(`
  CREATE TABLE IF NOT EXISTS comment_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    reaction_type TEXT CHECK(reaction_type IN ('like', 'doubt')),
    UNIQUE(comment_id, user_id, reaction_type),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 创建行级评论表
db.exec(`
  CREATE TABLE IF NOT EXISTS line_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    line_index INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`);

// 创建文字高亮表
db.exec(`
  CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    line_index INTEGER NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    color TEXT DEFAULT 'yellow',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 创建帖子想法区表（共享可编辑Markdown区域）
db.exec(`
  CREATE TABLE IF NOT EXISTS post_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    last_editor_id INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (last_editor_id) REFERENCES users(id)
  );
`);

// 创建收藏表
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL CHECK(content_type IN ('post', 'comment', 'result', 'idea', 'text_selection', 'image')),
    content_id INTEGER,
    post_id INTEGER NOT NULL,
    comment_id INTEGER,
    result_id INTEGER,
    text_data TEXT,
    image_url TEXT,
    line_index INTEGER,
    start_offset INTEGER,
    end_offset INTEGER,
    visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE CASCADE
  );
`);

// 创建收藏表索引
db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_post_id ON favorites(post_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_favorites_content_type ON favorites(content_type)`);

// 创建待办表
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_type TEXT NOT NULL CHECK(content_type IN ('post', 'comment', 'result', 'idea', 'text_selection', 'image')),
    content_id INTEGER,
    post_id INTEGER NOT NULL,
    comment_id INTEGER,
    result_id INTEGER,
    text_data TEXT,
    image_url TEXT,
    line_index INTEGER,
    start_offset INTEGER,
    end_offset INTEGER,
    note TEXT,
    is_completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE CASCADE
  );
`);

// 创建待办表索引
db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_post_id ON todos(post_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_is_completed ON todos(is_completed)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_content_type ON todos(content_type)`);

// 数据库迁移：为现有表添加 visibility 字段
// 为 favorites 表添加 visibility 字段
addColumnIfNotExists('favorites', 'visibility', "TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private'))");

// 为 todos 表添加 visibility 字段
addColumnIfNotExists('todos', 'visibility', "TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private'))");

// 为 todos 表添加 transferred_from 字段（用于流转功能）
addColumnIfNotExists('todos', 'transferred_from', 'INTEGER');

// ========== OCR相关表 ==========

// 帖子纯文字版表
db.exec(`
  CREATE TABLE IF NOT EXISTS posts_text (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    ocr_status TEXT DEFAULT 'pending' CHECK(ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_error TEXT,
    ocr_processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`);

// 评论纯文字版表
db.exec(`
  CREATE TABLE IF NOT EXISTS comments_text (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    ocr_status TEXT DEFAULT 'pending' CHECK(ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_error TEXT,
    ocr_processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
  );
`);

// 成果纯文字版表
db.exec(`
  CREATE TABLE IF NOT EXISTS results_text (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    ocr_status TEXT DEFAULT 'pending' CHECK(ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_error TEXT,
    ocr_processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE CASCADE
  );
`);

// 想法区纯文字版表
db.exec(`
  CREATE TABLE IF NOT EXISTS post_ideas_text (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    ocr_status TEXT DEFAULT 'pending' CHECK(ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_error TEXT,
    ocr_processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES post_ideas(id) ON DELETE CASCADE
  );
`);

// 待办纯文字版表
db.exec(`
  CREATE TABLE IF NOT EXISTS todos_text (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL,
    ocr_status TEXT DEFAULT 'pending' CHECK(ocr_status IN ('pending', 'processing', 'completed', 'failed')),
    ocr_error TEXT,
    ocr_processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );
`);

// OCR任务队列表
db.exec(`
  CREATE TABLE IF NOT EXISTS ocr_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 创建OCR队列索引
db.exec(`CREATE INDEX IF NOT EXISTS idx_ocr_queue_status ON ocr_queue(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_ocr_queue_created_at ON ocr_queue(created_at)`);

console.log('数据库表创建成功！');
db.close();

