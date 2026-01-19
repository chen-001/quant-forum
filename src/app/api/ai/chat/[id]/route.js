import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { chatQueries } from '@/lib/db';

// GET /api/ai/chat/[id] - 获取对话详情及消息
export async function GET(request, { params }) {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = Number.parseInt(id, 10);
    if (Number.isNaN(conversationId)) {
      return NextResponse.json({ error: '无效的对话ID' }, { status: 400 });
    }

    // 获取对话详情
    const conversation = chatQueries.findConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    // 验证权限
    if (conversation.user_id !== session.user.id) {
      return NextResponse.json({ error: '无权限访问此对话' }, { status: 403 });
    }

    // 获取消息
    const messages = chatQueries.findMessagesByConversationId(conversationId);

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    console.error('获取对话详情失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/ai/chat/[id] - 删除对话
export async function DELETE(request, { params }) {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = Number.parseInt(id, 10);
    if (Number.isNaN(conversationId)) {
      return NextResponse.json({ error: '无效的对话ID' }, { status: 400 });
    }

    // 验证权限
    const conversation = chatQueries.findConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    if (conversation.user_id !== session.user.id) {
      return NextResponse.json({ error: '无权限删除此对话' }, { status: 403 });
    }

    // 删除对话（由于外键约束，消息会自动删除）
    chatQueries.deleteConversation(conversationId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除对话失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/ai/chat/[id] - 更新对话标题
export async function PATCH(request, { params }) {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = Number.parseInt(id, 10);
    if (Number.isNaN(conversationId)) {
      return NextResponse.json({ error: '无效的对话ID' }, { status: 400 });
    }
    const body = await request.json();
    const { title } = body;

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    }

    // 验证权限
    const conversation = chatQueries.findConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    if (conversation.user_id !== session.user.id) {
      return NextResponse.json({ error: '无权限修改此对话' }, { status: 403 });
    }

    chatQueries.updateConversationTitle(conversationId, title.trim());

    const updatedConversation = chatQueries.findConversationById(conversationId);
    return NextResponse.json({ conversation: updatedConversation });
  } catch (error) {
    console.error('更新对话标题失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
