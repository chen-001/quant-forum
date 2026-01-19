import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { chatQueries } from '@/lib/db';
import { buildSystemPrompt } from '@/lib/ai-client';
import { createSession, chatWithSession, extractTextFromResponse } from '@/lib/opencode-client';

// POST /api/ai/chat/[id]/messages - 发送消息
export async function POST(request, { params }) {
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
    const { content } = body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
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

    let opencodeSessionId = conversation.opencode_session_id;
    if (!opencodeSessionId) {
      const sessionData = await createSession(conversation.title || `对话 ${conversation.id}`);
      opencodeSessionId = sessionData?.id || sessionData?.sessionId || sessionData?.session_id;
      if (!opencodeSessionId) {
        throw new Error('OpenCode会话创建失败');
      }
      chatQueries.updateConversationSession(conversationId, opencodeSessionId);
    }

    // 保存用户消息
    chatQueries.addMessage(conversationId, 'user', content);

    const systemPrompt = buildSystemPrompt(conversation.page_type);
    const response = await chatWithSession(opencodeSessionId, content, systemPrompt);
    const assistantText = extractTextFromResponse(response);

    if (!assistantText) {
      console.warn('OpenCode empty response', {
        sessionId: opencodeSessionId,
        responseKeys: response ? Object.keys(response) : null
      });
    }

    // 保存助手消息
    chatQueries.addMessage(
      conversationId,
      'assistant',
      assistantText || '（未收到有效回复）'
    );

    // 更新对话时间
    chatQueries.updateConversationTime(conversationId);

    // 获取完整消息列表
    const updatedMessages = chatQueries.findMessagesByConversationId(conversationId);

    return NextResponse.json({
      message: {
        role: 'assistant',
        content: assistantText || '（未收到有效回复）'
      },
      messages: updatedMessages
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
