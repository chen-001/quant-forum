import { generateSummariesForExistingPosts } from './ai-summary.js';
import { schedulerStatusQueries, summaryLogQueries } from './db.js';

// 5小时的毫秒数
const INTERVAL_MS = 5 * 60 * 60 * 1000;
const JOB_NAME = 'post_summary_scheduler';
let timerId = null;
let isRunning = false;

function formatUtcTimestamp(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

async function runBatchSummaries() {
  if (isRunning) {
    console.log('[定时任务] 批量摘要生成正在运行中，跳过本次执行');
    return;
  }

  isRunning = true;
  console.log('[定时任务] 开始批量生成摘要...');
  const startTime = Date.now();
  const startedAt = formatUtcTimestamp(new Date(startTime));

  try {
    const result = await generateSummariesForExistingPosts({ triggerType: 'auto', scope: 'batch' });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[定时任务] 批量摘要生成完成 (耗时${elapsed}秒):`, result);

    const finishedAt = formatUtcTimestamp(new Date());
    schedulerStatusQueries.upsert(JOB_NAME, {
      lastRunAt: finishedAt,
      nextRunAt: formatUtcTimestamp(new Date(Date.now() + INTERVAL_MS)),
      lastStatus: 'success',
      lastDurationSec: parseFloat(elapsed)
    });

    summaryLogQueries.create({
      triggerType: 'auto',
      scope: 'batch',
      summaryType: 'batch',
      status: 'success',
      note: `批量完成: total=${result.total}, full=${result.fullUpdate}, supplement=${result.supplement}, skipped=${result.skipped}, fail=${result.fail}`,
      startedAt,
      finishedAt,
      durationSec: parseFloat(elapsed)
    });
  } catch (error) {
    console.error('[定时任务] 批量摘要生成失败:', error);

    const finishedAt = formatUtcTimestamp(new Date());
    schedulerStatusQueries.upsert(JOB_NAME, {
      lastRunAt: finishedAt,
      nextRunAt: formatUtcTimestamp(new Date(Date.now() + INTERVAL_MS)),
      lastStatus: 'failed',
      lastDurationSec: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))
    });

    summaryLogQueries.create({
      triggerType: 'auto',
      scope: 'batch',
      summaryType: 'batch',
      status: 'failed',
      note: error?.message || '批量摘要生成失败',
      startedAt,
      finishedAt,
      durationSec: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))
    });
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

  schedulerStatusQueries.upsert(JOB_NAME, {
    nextRunAt: formatUtcTimestamp(new Date(Date.now() + INTERVAL_MS)),
    lastStatus: 'scheduled'
  });

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
