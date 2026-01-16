import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { favoriteQueries } from '@/lib/db';

// DELETE /api/favorites/[id] - 删除收藏
export async function DELETE(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;

        // 验证收藏是否属于当前用户
        const favorite = favoriteQueries.findById(parseInt(id));
        if (!favorite) {
            return NextResponse.json({ error: '收藏不存在' }, { status: 404 });
        }
        if (favorite.user_id !== session.user.id) {
            return NextResponse.json({ error: '无权删除此收藏' }, { status: 403 });
        }

        favoriteQueries.delete(parseInt(id), session.user.id);

        return NextResponse.json({ message: '删除成功' });
    } catch (error) {
        console.error('Delete favorite error:', error);
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
}
