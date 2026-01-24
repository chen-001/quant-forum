import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { activityLogQueries, todoQueries } from '@/lib/db';
import { ocrTextQueries } from '@/lib/ocr-queries';

// PATCH /api/todos/[id]/note - 更新说明
export async function PATCH(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const { id } = await params;
        const { note } = await request.json();

        // 验证待办是否属于当前用户
        const todo = todoQueries.findById(parseInt(id));
        if (!todo) {
            return NextResponse.json({ error: '待办不存在' }, { status: 404 });
        }
        if (todo.user_id !== session.user.id) {
            return NextResponse.json({ error: '无权修改此待办' }, { status: 403 });
        }

        todoQueries.updateNote(parseInt(id), note || '');
        activityLogQueries.create({
            category: 'favorites_todos',
            action: 'todo_note_updated',
            actorId: session.user.id,
            relatedUserId: session.user.id,
            postId: todo.post_id,
            todoId: todo.id
        });

        // 如果note内容包含图片，添加OCR任务
        if (note && note.includes('![')) {
            ocrTextQueries.scheduleOCR('todo', parseInt(id), note);
        }

        return NextResponse.json({ message: '说明更新成功' });
    } catch (error) {
        console.error('Update todo note error:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
}
