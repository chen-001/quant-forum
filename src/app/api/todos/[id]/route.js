import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { todoQueries } from '@/lib/db';

// DELETE /api/todos/[id] - 删除待办
export async function DELETE(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;

        // 验证待办是否属于当前用户
        const todo = todoQueries.findById(parseInt(id));
        if (!todo) {
            return NextResponse.json({ error: '待办不存在' }, { status: 404 });
        }
        if (todo.user_id !== session.user.id) {
            return NextResponse.json({ error: '无权删除此待办' }, { status: 403 });
        }

        todoQueries.delete(parseInt(id), session.user.id);

        return NextResponse.json({ message: '删除成功' });
    } catch (error) {
        console.error('Delete todo error:', error);
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
}
