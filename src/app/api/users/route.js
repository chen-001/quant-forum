import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { getDb } from '@/lib/db';

// GET /api/users - 获取用户列表及其待办统计
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const db = getDb();
        const stmt = db.prepare(`
            SELECT
                u.id,
                u.username,
                COUNT(CASE WHEN t.is_completed = 0 THEN 1 END) as incomplete_count,
                COUNT(CASE WHEN t.is_completed = 1 THEN 1 END) as completed_count
            FROM users u
            LEFT JOIN todos t ON u.id = t.user_id
            GROUP BY u.id
            ORDER BY u.username
        `);

        const users = stmt.all();

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
    }
}
