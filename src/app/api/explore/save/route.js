import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { commentExplorationQueries } from '@/lib/db';

// POST /api/explore/save - 保存用户修改的代码
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { commentId, variants } = body;

        if (!commentId) {
            return NextResponse.json({ error: '缺少commentId参数' }, { status: 400 });
        }

        if (!variants || !Array.isArray(variants)) {
            return NextResponse.json({ error: 'variants必须是数组' }, { status: 400 });
        }

        // 检查记录是否存在
        const existing = commentExplorationQueries.getByCommentId(parseInt(commentId));
        if (!existing) {
            return NextResponse.json({ error: '探索记录不存在' }, { status: 404 });
        }

        // 保存用户修改的版本
        commentExplorationQueries.update(parseInt(commentId), { userModifiedVariants: variants });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('保存探索方案失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
