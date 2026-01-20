import { generateSummariesForExistingPosts } from './ai-summary.js';

// 5小时的毫秒数
const INTERVAL_MS = 5 * 60 * 60 * 1000;
let timerId = null;
let isRunning = false;

async function runBatchSummaries() {
  if (isRunning) {
    console.log('[定时任务] 批量摘要生成正在运行中，跳过本次执行');
    return;
  }

  isRunning = true;
  console.log('[定时任务] 开始批量生成摘要...');
  const startTime = Date.now();

  try {
    const result = await generateSummariesForExistingPosts();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[定时任务] 批量摘要生成完成 (耗时${elapsed}秒):`, result);
  } catch (error) {
    console.error('[定时任务] 批量摘要生成失败:', error);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  if (timerId) {
    console.log('[定时任务] 调度器已在运行');
    return;
  }

  console.log(`[定时任务] 启动调度器，每${INTERVAL_MS / 1000 / 60 / 60}小时运行一次批量摘要生成`);

  // 立即执行一次（可选，如果希望启动后立即运行）
  // runBatchSummaries();

  // 启动定时器
  timerId = setInterval(() => {
    runBatchSummaries();
  }, INTERVAL_MS);
}

export function stopScheduler() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log('[定时任务] 调度器已停止');
  }
}

// 导出函数供手动触发
export { runBatchSummaries };
