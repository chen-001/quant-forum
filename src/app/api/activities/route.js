import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { activityLogQueries, activityViewQueries } from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || 'all';
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const stats = searchParams.get('stats') === '1';

        if (stats) {
            const views = activityViewQueries.getByUserId(session.user.id);
            const relatedCount = activityLogQueries.countNew({
                scope: 'related',
                userId: session.user.id,
                lastSeenRelated: views?.last_seen_related || null
            });
            const allCount = activityLogQueries.countNew({
                scope: 'all',
                lastSeenAll: views?.last_seen_all || null
            });
            return NextResponse.json({
                relatedCount,
                allCount,
                lastSeenRelated: views?.last_seen_related || null,
                lastSeenAll: views?.last_seen_all || null
            });
        }

        const activities = activityLogQueries.listPaged({
            scope,
            userId: session.user.id,
            limit,
            offset
        });
        const total = activityLogQueries.count({ scope, userId: session.user.id });

        return NextResponse.json({ activities, total });
    } catch (error) {
        console.error('Get activities error:', error);
        return NextResponse.json({ error: '获取动态失败' }, { status: 500 });
    }
}
