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

        const { targetUserId } = await request.json();

        if (!targetUserId) {
            return NextResponse.json({ error: '缺少目标用户ID' }, { status: 400 });
        }

        const { id } = await params;
        const todoId = parseInt(id);

        // 验证待办是否属于当前用户
        const todo = todoQueries.findById(todoId);
        if (!todo) {
            return NextResponse.json({ error: '待办不存在' }, { status: 404 });
        }
        if (todo.user_id !== session.user.id) {
            return NextResponse.json({ error: '无权流转此待办' }, { status: 403 });
        }

        // 不能流转给自己
        if (targetUserId === session.user.id) {
            return NextResponse.json({ error: '不能流转给自己' }, { status: 400 });
        }

        // 执行流转
        const result = todoQueries.transfer(todoId, targetUserId, session.user.id);

        if (result.changes === 0) {
            return NextResponse.json({ error: '流转失败' }, { status: 500 });
        }

        return NextResponse.json({
            message: '流转成功',
            todoId,
            targetUserId
        });
    } catch (error) {
        console.error('Transfer todo error:', error);
        return NextResponse.json({ error: '流转失败' }, { status: 500 });
    }
}
