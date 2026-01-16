import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { todoQueries } from '@/lib/db';

export async function PATCH(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { visibility } = await request.json();

        if (!['public', 'private'].includes(visibility)) {
            return NextResponse.json({ error: '无效的可见性设置' }, { status: 400 });
        }

        const result = todoQueries.updateVisibility(
            parseInt(params.id),
            session.user.id,
            visibility
        );

        if (result.changes === 0) {
            return NextResponse.json({ error: '待办不存在或无权限' }, { status: 404 });
        }

        return NextResponse.json({ message: '更新成功' });
    } catch (error) {
        console.error('Update visibility error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
}
