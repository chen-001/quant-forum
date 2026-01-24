import { NextResponse } from 'next/server';
import { activityLogQueries, postSummaryQueries, summaryLogQueries } from '@/lib/db';
import { regeneratePostSummary, smartUpdateSummary } from '@/lib/ai-summary';
import { getSessionFromCookies } from '@/lib/session';
import { cookies } from 'next/headers';

const formatUtcTimestamp = (date) => date.toISOString().replace('T', ' ').replace('Z', '');
const truncateLogValue = (value, limit = 120) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
};

// GET /api/summaries/[postId] - 获取单个摘要
export async function GET(request, { params }) {
  const { postId } = await params;
  const summary = postSummaryQueries.getEffective(parseInt(postId));

  if (!summary) {
    return NextResponse.json({ error: '摘要不存在' }, { status: 404 });
  }

  return NextResponse.json({ summary });
}

// PUT /api/summaries/[postId] - 更新用户编辑
export async function PUT(request, { params }) {
  const { postId } = await params;
  const session = await getSessionFromCookies(await cookies());
  if (!session.user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const body = await request.json();
  const numericPostId = parseInt(postId);
  const startTime = Date.now();
  const startedAt = formatUtcTimestamp(new Date(startTime));
  const existing = postSummaryQueries.getByPostId(numericPostId);
  const contentHashBefore = existing?.last_post_hash || null;
  const contentHashAfter = contentHashBefore;

  const exists = postSummaryQueries.exists(numericPostId);
  if (!exists) {
    return NextResponse.json({ error: '摘要不存在' }, { status: 404 });
  }

  // 支持单字段更新和批量更新
  if (body.field && body.value !== undefined) {
    const result = postSummaryQueries.updateUserEdit(numericPostId, body.field, body.value);
    summaryLogQueries.create({
      triggerType: 'manual',
      scope: 'single',
      postId: numericPostId,
      summaryType: 'edit',
      status: 'success',
      note: `用户编辑字段 ${body.field}: ${truncateLogValue(body.value)}`,
      startedAt,
      finishedAt: formatUtcTimestamp(new Date()),
      durationSec: (Date.now() - startTime) / 1000,
      contentHashBefore,
      contentHashAfter
    });
    activityLogQueries.create({
      category: 'summary',
      action: 'summary_field_updated',
      actorId: session.user.id,
      relatedUserId: session.user.id,
      postId: numericPostId,
      summaryId: existing?.id || null,
      meta: {
        field: body.field
      }
    });
    return NextResponse.json({ success: result.changes > 0 });
  } else if (body.updates) {
    const result = postSummaryQueries.updateUserEditBatch(numericPostId, body.updates);
    const fields = Object.keys(body.updates || {});
    summaryLogQueries.create({
      triggerType: 'manual',
      scope: 'single',
      postId: numericPostId,
      summaryType: 'edit',
      status: 'success',
      note: `用户批量编辑字段: ${fields.join(', ') || '-'}`,
      startedAt,
      finishedAt: formatUtcTimestamp(new Date()),
      durationSec: (Date.now() - startTime) / 1000,
      contentHashBefore,
      contentHashAfter
    });
    activityLogQueries.create({
      category: 'summary',
      action: 'summary_batch_updated',
      actorId: session.user.id,
      relatedUserId: session.user.id,
      postId: numericPostId,
      summaryId: existing?.id || null,
      meta: {
        fields
      }
    });
    return NextResponse.json({ success: result.changes > 0 });
  }

  return NextResponse.json({ error: '缺少更新参数' }, { status: 400 });
}

// DELETE /api/summaries/[postId] - 清除用户编辑
export async function DELETE(request, { params }) {
  const { postId } = await params;
  const { searchParams } = new URL(request.url);
  const field = searchParams.get('field');

  const exists = postSummaryQueries.exists(parseInt(postId));
  if (!exists) {
    return NextResponse.json({ error: '摘要不存在' }, { status: 404 });
  }

  const result = postSummaryQueries.clearUserEdit(parseInt(postId), field);
  return NextResponse.json({ success: result.changes > 0 });
}

// PATCH /api/summaries/[postId] - 重新生成摘要
export async function PATCH(request, { params }) {
  const { postId } = await params;
  const body = await request.json().catch(() => ({}));
  const clearUserEdits = body.clearUserEdits || false;
  const forceFullUpdate = body.forceFullUpdate || false;
  const numericPostId = parseInt(postId);
  const startTime = Date.now();
  const startedAt = formatUtcTimestamp(new Date(startTime));
  const existing = postSummaryQueries.getByPostId(numericPostId);
  const contentHashBefore = existing?.last_post_hash || null;
  let contentHashAfter = contentHashBefore;

  if (clearUserEdits) {
    try {
      const summary = await regeneratePostSummary(numericPostId, true);
      contentHashAfter = summary?.content_hash || contentHashAfter;
      summaryLogQueries.create({
        triggerType: 'manual',
        scope: 'single',
        postId: numericPostId,
        summaryType: 'full',
        status: 'success',
        note: '手动完整重生成摘要',
        startedAt,
        finishedAt: formatUtcTimestamp(new Date()),
        durationSec: (Date.now() - startTime) / 1000,
        contentHashBefore,
        contentHashAfter
      });
      return NextResponse.json({ summary, type: 'regenerate' });
    } catch (error) {
      summaryLogQueries.create({
        triggerType: 'manual',
        scope: 'single',
        postId: numericPostId,
        summaryType: 'failed',
        status: 'failed',
        note: error?.message || '手动重生成摘要失败',
        startedAt,
        finishedAt: formatUtcTimestamp(new Date()),
        durationSec: (Date.now() - startTime) / 1000,
        contentHashBefore,
        contentHashAfter
      });
      throw error;
    }
  } else {
    try {
      const result = await smartUpdateSummary(numericPostId, forceFullUpdate);
      if (result.type === 'full') {
        contentHashAfter = result.data?.content_hash || contentHashAfter;
        summaryLogQueries.create({
          triggerType: 'manual',
          scope: 'single',
          postId: numericPostId,
          summaryType: 'full',
          status: 'success',
          note: '手动完整摘要更新',
          startedAt,
          finishedAt: formatUtcTimestamp(new Date()),
          durationSec: (Date.now() - startTime) / 1000,
          contentHashBefore,
          contentHashAfter
        });
      } else if (result.type === 'supplement') {
        contentHashAfter = result.data?.content_hash || contentHashAfter;
        summaryLogQueries.create({
          triggerType: 'manual',
          scope: 'single',
          postId: numericPostId,
          summaryType: 'supplement',
          status: 'success',
          note: '手动增量补充摘要',
          startedAt,
          finishedAt: formatUtcTimestamp(new Date()),
          durationSec: (Date.now() - startTime) / 1000,
          contentHashBefore,
          contentHashAfter
        });
      } else {
        summaryLogQueries.create({
          triggerType: 'manual',
          scope: 'single',
          postId: numericPostId,
          summaryType: 'skip',
          status: 'skipped',
          note: result.reason || '内容未变化，跳过',
          startedAt,
          finishedAt: formatUtcTimestamp(new Date()),
          durationSec: (Date.now() - startTime) / 1000,
          contentHashBefore,
          contentHashAfter
        });
      }
      return NextResponse.json(result);
    } catch (error) {
      summaryLogQueries.create({
        triggerType: 'manual',
        scope: 'single',
        postId: numericPostId,
        summaryType: 'failed',
        status: 'failed',
        note: error?.message || '手动摘要更新失败',
        startedAt,
        finishedAt: formatUtcTimestamp(new Date()),
        durationSec: (Date.now() - startTime) / 1000,
        contentHashBefore,
        contentHashAfter
      });
      throw error;
    }
  }
}
