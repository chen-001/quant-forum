import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { chatQueries } from '@/lib/db';
import { buildSystemPrompt } from '@/lib/ai-client';
import { createSession, streamChatEvents } from '@/lib/opencode-client';

export async function POST(request, { params }) {
  const session = await getSessionFromCookies(await cookies());
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number.parseInt(id, 10);
  if (Number.isNaN(conversationId)) {
    return new Response('Invalid conversation ID', { status: 400 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return new Response('Content is required', { status: 400 });
  }

  // 验证对话权限
  const conversation = chatQueries.findConversationById(conversationId);
  if (!conversation) {
    return new Response('Conversation not found', { status: 404 });
  }
  if (conversation.user_id !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  // 获取或创建OpenCode会话
  let opencodeSessionId = conversation.opencode_session_id;
  if (!opencodeSessionId) {
    const sessionData = await createSession(conversation.title || `对话 ${conversation.id}`);
    opencodeSessionId = sessionData?.id || sessionData?.sessionId || sessionData?.session_id;
    if (!opencodeSessionId) {
      return new Response('Failed to create OpenCode session', { status: 500 });
    }
    chatQueries.updateConversationSession(conversationId, opencodeSessionId);
  }

  // 保存用户消息
  chatQueries.addMessage(conversationId, 'user', content);

  // 创建SSE流
  const encoder = new TextEncoder();
  const systemPrompt = buildSystemPrompt(conversation.page_type);

  // 创建 AbortController 用于取消请求
  const abortController = new AbortController();

  // 监听客户端断开连接
  request.signal?.addEventListener('abort', () => {
    abortController.abort();
  });

  const stream = new ReadableStream({
    async start(controller) {
      // 用于累积完整内容
      let fullAssistantText = '';
      let fullReasoning = '';
      const toolCalls = [];

      try {
        for await (const event of streamChatEvents(opencodeSessionId, content, systemPrompt, abortController.signal)) {
          const sseEvent = { type: event.type };

          switch (event.type) {
            case 'reasoning':
              sseEvent.text = event.text || '';
              fullReasoning += event.text || '';
              break;
            case 'tool':
              sseEvent.tool = event.tool;
              sseEvent.status = event.status;
              sseEvent.title = event.title;
              sseEvent.input = event.input;
              sseEvent.output = event.output;
              // 记录工具调用（只记录完成的）
              if (event.status === 'completed' || event.status === 'error') {
                const existingIndex = toolCalls.findIndex(t => t.tool === event.tool && t.title === event.title);
                if (existingIndex >= 0) {
                  toolCalls[existingIndex] = {
                    tool: event.tool,
                    status: event.status,
                    title: event.title,
                    input: event.input,
                    output: event.output
                  };
                } else {
                  toolCalls.push({
                    tool: event.tool,
                    status: event.status,
                    title: event.title,
                    input: event.input,
                    output: event.output
                  });
                }
              }
              break;
            case 'text':
              sseEvent.text = event.text || '';
              fullAssistantText += event.text || '';
              break;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`));
        }

        // 保存助手消息（包含思考过程和工具调用）
        if (fullAssistantText || fullReasoning || toolCalls.length > 0) {
          const messageData = {
            reasoning: fullReasoning || null,
            toolCalls: toolCalls.length > 0 ? toolCalls : null
          };
          chatQueries.addMessage(conversationId, 'assistant', fullAssistantText, messageData);
          chatQueries.updateConversationTime(conversationId);
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));

      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
