import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { activityViewQueries } from '@/lib/db';

export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const scope = body.scope || 'all';
        const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

        if (scope === 'all') {
            activityViewQueries.upsert({ userId: session.user.id, lastSeenAll: now });
        } else if (scope === 'related') {
            activityViewQueries.upsert({ userId: session.user.id, lastSeenRelated: now });
        } else if (scope === 'both') {
            activityViewQueries.upsert({ userId: session.user.id, lastSeenAll: now, lastSeenRelated: now });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Mark activities seen error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
}
