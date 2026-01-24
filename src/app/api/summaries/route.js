import { NextResponse } from 'next/server';
import { postSummaryQueries, schedulerStatusQueries, summaryLogQueries } from '@/lib/db';
import { generateSummariesForExistingPosts } from '@/lib/ai-summary';

// GET /api/summaries - 获取所有摘要
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const limit = parseInt(searchParams.get('limit') || '100');
  const logLimit = parseInt(searchParams.get('logLimit') || '100');

  const summaries = keyword
    ? postSummaryQueries.search(keyword, limit)
    : postSummaryQueries.getAll();

  const schedule = schedulerStatusQueries.get('post_summary_scheduler');
  const recentLogs = summaryLogQueries.listRecent(logLimit);

  return NextResponse.json({ summaries, schedule, recent_logs: recentLogs });
}

// POST /api/summaries - 重新生成全部摘要
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const forceFullUpdate = body.forceFullUpdate || false;

  const result = await generateSummariesForExistingPosts({
    forceFullUpdate,
    triggerType: 'manual',
    scope: 'batch'
  });
  return NextResponse.json(result);
}
