import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 计算项目根目录（兼容开发和生产环境）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

// 读取配置文件获取API key
let zhipuaiApiKey = '';
async function loadConfig() {
    try {
        const configPath = path.join(projectRoot, 'data', 'config.json');
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        zhipuaiApiKey = config.zhipuai_api_key || '';
    } catch (e) {
        console.error('加载配置文件失败:', e.message);
    }
}
loadConfig();

const PYTHON_PATH = '/home/chenzongwei/.conda/envs/chenzongwei311/bin/python3';
const OCR_SCRIPT = path.join(projectRoot, 'scripts', 'ocr_processor.py');
const FAILED_LOG_PATH = path.join(projectRoot, 'data', 'ocr_failed.txt');

let isRunning = false;
let processingCount = 0;
const MAX_CONCURRENT = 5;

const TABLE_MAPPING = {
    'post': { textTable: 'posts_text', idColumn: 'post_id' },
    'comment': { textTable: 'comments_text', idColumn: 'comment_id' },
    'result': { textTable: 'results_text', idColumn: 'result_id' },
    'idea': { textTable: 'post_ideas_text', idColumn: 'idea_id' },
    'todo': { textTable: 'todos_text', idColumn: 'todo_id' }
};

async function logFailedImage(filename, error) {
    try {
        const dir = path.dirname(FAILED_LOG_PATH);
        await fs.mkdir(dir, { recursive: true });
        const timestamp = new Date().toLocaleString('zh-CN');
        const logLine = `${filename} | ${error} | ${timestamp}\n`;
        await fs.appendFile(FAILED_LOG_PATH, logLine);
    } catch (e) {
        console.error('记录失败图片日志出错:', e);
    }
}

async function extractFilename(imageUrl) {
    const match = imageUrl.match(/\/uploads\/([^\/]+\.(jpg|jpeg|png|gif|webp))/i);
    return match ? match[1] : imageUrl;
}

async function runPythonOCR(content) {
    return new Promise((resolve) => {
        const contentJson = JSON.stringify({ content });
        const python = spawn(PYTHON_PATH, [OCR_SCRIPT, 'process', contentJson, projectRoot], {
            timeout: 180000,
            env: {
                ...process.env,
                ZHIPUAI_API_KEY: zhipuaiApiKey
            }
        });

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => { stdout += data.toString(); });
        python.stderr.on('data', (data) => { stderr += data.toString(); });

        python.on('close', (code) => {
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch {
                resolve({ success: false, error: stderr || '解析输出失败' });
            }
        });

        python.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

async function processTask(db, task) {
    const updateStatus = (status, errorMsg = null) => {
        const stmt = db.prepare(`
            UPDATE ocr_queue
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            ${status === 'processing' ? ', processed_at = CURRENT_TIMESTAMP' : ''}
            WHERE id = ?
        `);
        stmt.run(status, errorMsg, task.id);
    };

    updateStatus('processing');

    const mapping = TABLE_MAPPING[task.task_type];
    if (!mapping) {
        updateStatus('failed', `未知任务类型: ${task.task_type}`);
        return;
    }

    try {
        const getStmt = db.prepare(`
            SELECT c.content
            FROM ${task.task_type === 'idea' ? 'post_ideas' : task.task_type + 's'} c
            WHERE c.id = ?
        `);

        const row = getStmt.get(task.target_id);
        if (!row) {
            updateStatus('failed', '记录不存在');
            return;
        }

        const ocrResult = await runPythonOCR(row.content);

        if (!ocrResult.success) {
            const filename = await extractFilename(task.image_url);
            await logFailedImage(filename, ocrResult.error);
            updateStatus('failed', ocrResult.error);
            return;
        }

        const upsertStmt = db.prepare(`
            INSERT INTO ${mapping.textTable} (${mapping.idColumn}, content, ocr_status, ocr_processed_at)
            VALUES (?, ?, 'completed', CURRENT_TIMESTAMP)
            ON CONFLICT(${mapping.idColumn}) DO UPDATE SET
                content = excluded.content,
                ocr_status = 'completed',
                ocr_processed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `);
        upsertStmt.run(task.target_id, ocrResult.processed_content);

        updateStatus('completed');

    } catch (error) {
        const filename = await extractFilename(task.image_url);
        await logFailedImage(filename, error.message);
        updateStatus('failed', error.message);
    }
}

async function processQueue(db) {
    if (processingCount >= MAX_CONCURRENT) return;

    const stmt = db.prepare(`
        SELECT * FROM ocr_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?
    `);

    const tasks = stmt.all(MAX_CONCURRENT - processingCount);

    for (const task of tasks) {
        processingCount++;
        processTask(db, task).finally(() => {
            processingCount--;
        });
    }
}

function start(db) {
    if (isRunning) return;
    isRunning = true;

    const interval = setInterval(() => {
        processQueue(db);
    }, 5000);

    return () => {
        clearInterval(interval);
        isRunning = false;
    };
}

function addTask(db, taskType, targetId, imageUrl) {
    const stmt = db.prepare(`
        INSERT INTO ocr_queue (task_type, target_id, image_url, status)
        VALUES (?, ?, ?, 'pending')
    `);
    const result = stmt.run(taskType, targetId, imageUrl);
    return result.lastInsertRowid;
}

function getPendingCount(db) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM ocr_queue WHERE status = "pending"');
    return stmt.get().count;
}

function getFailedTasks(db, limit = 100) {
    const stmt = db.prepare(`
        SELECT * FROM ocr_queue
        WHERE status = 'failed'
        ORDER BY created_at DESC
        LIMIT ?
    `);
    return stmt.all(limit);
}

function retryTask(db, taskId) {
    const stmt = db.prepare(`
        UPDATE ocr_queue
        SET status = 'pending', retry_count = retry_count + 1, error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND retry_count < max_retries
    `);
    return stmt.run(taskId);
}

export const ocrQueue = {
    start,
    addTask,
    getPendingCount,
    getFailedTasks,
    retryTask
};
