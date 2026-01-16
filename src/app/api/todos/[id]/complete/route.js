import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { todoQueries } from '@/lib/db';

// PATCH /api/todos/[id]/complete - 标记完成/未完成
export async function PATCH(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const { isCompleted } = await request.json();

        // 验证待办是否属于当前用户
        const todo = todoQueries.findById(parseInt(id));
        if (!todo) {
            return NextResponse.json({ error: '待办不存在' }, { status: 404 });
        }
        if (todo.user_id !== session.user.id) {
            return NextResponse.json({ error: '无权修改此待办' }, { status: 403 });
        }

        todoQueries.updateCompleteStatus(parseInt(id), isCompleted);

        return NextResponse.json({ message: isCompleted ? '已标记为完成' : '已标记为未完成' });
    } catch (error) {
        console.error('Update todo status error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
}
