import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { postQueries } from '@/lib/db';

// 切换帖子置顶状态 - 仅原作者可操作
export async function POST(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const post = postQueries.findById(id);

        if (!post) {
            return NextResponse.json({ error: '帖子不存在' }, { status: 404 });
        }

        // 检查是否是原作者
        if (post.author_id !== session.user.id) {
            return NextResponse.json({ error: '只有原作者可以置顶帖子' }, { status: 403 });
        }

        // 切换置顶状态
        const newPinnedState = !post.is_pinned;
        postQueries.togglePin(id, newPinnedState);

        return NextResponse.json({
            message: newPinnedState ? '帖子已置顶' : '已取消置顶',
            is_pinned: newPinnedState
        });
    } catch (error) {
        console.error('Toggle pin error:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }
}
