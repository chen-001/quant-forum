#!/usr/bin/env node
/**
 * 批量OCR脚本 - 处理历史数据中的图片
 * 扫描所有包含图片的历史内容，为每条记录创建OCR任务
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'forum.db');
const db = new Database(dbPath);
const progressFile = path.join(process.cwd(), 'data', 'batch_ocr_progress.json');

const IMAGE_PATTERN = /!\[.*?\]\((\/uploads\/[^)]+)\)/g;

function extractImages(content) {
    if (!content) return [];
    const images = [];
    let match;
    while ((match = IMAGE_PATTERN.exec(content)) !== null) {
        images.push(match[1]);
    }
    return images;
}

function loadProgress() {
    try {
        const fs = require('fs');
        if (require('fs').existsSync(progressFile)) {
            return JSON.parse(require('fs').readFileSync(progressFile, 'utf8'));
        }
    } catch (e) {
        console.error('加载进度文件失败:', e.message);
    }
    return { processed: {}, failed: {} };
}

function saveProgress(progress) {
    try {
        const fs = require('fs');
        const dir = path.dirname(progressFile);
        require('fs').mkdirSync(dir, { recursive: true });
        require('fs').writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    } catch (e) {
        console.error('保存进度文件失败:', e.message);
    }
}

function isProcessed(progress, type, id) {
    return progress.processed[`${type}:${id}`];
}

function markProcessed(progress, type, id) {
    progress.processed[`${type}:${id}`] = true;
    saveProgress(progress);
}

function markFailed(progress, type, id, error) {
    progress.failed[`${type}:${id}`] = { error, time: new Date().toISOString() };
    saveProgress(progress);
}

function batchProcessPosts(progress) {
    console.log('处理帖子...');
    const stmt = db.prepare('SELECT id, content FROM posts WHERE content IS NOT NULL AND LENGTH(content) > 0');
    const posts = stmt.all();

    let count = 0;
    for (const post of posts) {
        if (isProcessed(progress, 'post', post.id)) continue;

        const images = extractImages(post.content);
        if (images.length > 0) {
            const insert = db.prepare("INSERT INTO ocr_queue (task_type, target_id, image_url, status) VALUES (?, ?, ?, 'pending')");
            for (const imageUrl of images) {
                insert.run('post', post.id, imageUrl);
            }
            markProcessed(progress, 'post', post.id);
            count++;
        }
    }
    console.log(`帖子完成: ${count} 条`);
}

function batchProcessComments(progress) {
    console.log('处理评论...');
    const stmt = db.prepare('SELECT id, content FROM comments WHERE content IS NOT NULL AND LENGTH(content) > 0');
    const comments = stmt.all();

    let count = 0;
    for (const comment of comments) {
        if (isProcessed(progress, 'comment', comment.id)) continue;

        const images = extractImages(comment.content);
        if (images.length > 0) {
            const insert = db.prepare("INSERT INTO ocr_queue (task_type, target_id, image_url, status) VALUES (?, ?, ?, 'pending')");
            for (const imageUrl of images) {
                insert.run('comment', comment.id, imageUrl);
            }
            markProcessed(progress, 'comment', comment.id);
            count++;
        }
    }
    console.log(`评论完成: ${count} 条`);
}

function batchProcessResults(progress) {
    console.log('处理成果...');
    const stmt = db.prepare('SELECT id, content FROM results WHERE content IS NOT NULL AND LENGTH(content) > 0');
    const results = stmt.all();

    let count = 0;
    for (const result of results) {
        if (isProcessed(progress, 'result', result.id)) continue;

        const images = extractImages(result.content);
        if (images.length > 0) {
            const insert = db.prepare("INSERT INTO ocr_queue (task_type, target_id, image_url, status) VALUES (?, ?, ?, 'pending')");
            for (const imageUrl of images) {
                insert.run('result', result.id, imageUrl);
            }
            markProcessed(progress, 'result', result.id);
            count++;
        }
    }
    console.log(`成果完成: ${count} 条`);
}

function batchProcessIdeas(progress) {
    console.log('处理想法区...');
    const stmt = db.prepare('SELECT id, content FROM post_ideas WHERE content IS NOT NULL AND LENGTH(content) > 0');
    const ideas = stmt.all();

    let count = 0;
    for (const idea of ideas) {
        if (isProcessed(progress, 'idea', idea.id)) continue;

        const images = extractImages(idea.content);
        if (images.length > 0) {
            const insert = db.prepare("INSERT INTO ocr_queue (task_type, target_id, image_url, status) VALUES (?, ?, ?, 'pending')");
            for (const imageUrl of images) {
                insert.run('idea', idea.id, imageUrl);
            }
            markProcessed(progress, 'idea', idea.id);
            count++;
        }
    }
    console.log(`想法区完成: ${count} 条`);
}

function batchProcessTodos(progress) {
    console.log('处理待办...');
    const stmt = db.prepare('SELECT id, note FROM todos WHERE note IS NOT NULL AND LENGTH(note) > 0');
    const todos = stmt.all();

    let count = 0;
    for (const todo of todos) {
        if (isProcessed(progress, 'todo', todo.id)) continue;

        const images = extractImages(todo.note);
        if (images.length > 0) {
            const insert = db.prepare("INSERT INTO ocr_queue (task_type, target_id, image_url, status) VALUES (?, ?, ?, 'pending')");
            for (const imageUrl of images) {
                insert.run('todo', todo.id, imageUrl);
            }
            markProcessed(progress, 'todo', todo.id);
            count++;
        }
    }
    console.log(`待办完成: ${count} 条`);
}

function showStats() {
    const pending = db.prepare("SELECT COUNT(*) as count FROM ocr_queue WHERE status = 'pending'").get();
    const processing = db.prepare("SELECT COUNT(*) as count FROM ocr_queue WHERE status = 'processing'").get();
    const completed = db.prepare("SELECT COUNT(*) as count FROM ocr_queue WHERE status = 'completed'").get();
    const failed = db.prepare("SELECT COUNT(*) as count FROM ocr_queue WHERE status = 'failed'").get();

    console.log('\n=== OCR队列状态 ===');
    console.log(`待处理: ${pending.count}`);
    console.log(`处理中: ${processing.count}`);
    console.log(`已完成: ${completed.count}`);
    console.log(`失败: ${failed.count}`);
}

function main() {
    const command = process.argv[2];

    switch (command) {
        case 'scan':
            const progress = loadProgress();
            batchProcessPosts(progress);
            batchProcessComments(progress);
            batchProcessResults(progress);
            batchProcessIdeas(progress);
            batchProcessTodos(progress);
            console.log('\n扫描完成，已将任务添加到队列');
            break;

        case 'reset':
            db.prepare('DELETE FROM ocr_queue').run();
            const fs = require('fs');
            if (fs.existsSync(progressFile)) {
                fs.unlinkSync(progressFile);
            }
            console.log('进度已重置');
            break;

        case 'stats':
        default:
            showStats();
            break;
    }

    db.close();
}

main();
