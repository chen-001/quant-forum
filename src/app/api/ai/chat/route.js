import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { chatQueries } from '@/lib/db';
import { chatWithTools, buildSystemPrompt } from '@/lib/ai-client';
import { AI_FUNCTION_SCHEMAS } from '@/lib/ai-function-schemas';
import { createToolExecutor } from '@/lib/ai-tools';

// GET /api/ai/chat - 获取用户的所有对话
export async function GET(request) {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const conversations = chatQueries.findConversationsByUserId(session.user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('获取对话列表失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/ai/chat - 创建新对话
export async function POST(request) {
  try {
    const session = await getSessionFromCookies(await cookies());
    if (!session?.user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { pageType, contextId, title } = body;

    // 验证 pageType
    const validPageTypes = ['home', 'post_detail', 'favorites_mine', 'favorites_all', 'todos_mine', 'todos_all'];
    if (!validPageTypes.includes(pageType)) {
      return NextResponse.json({ error: '无效的页面类型' }, { status: 400 });
    }

    const result = chatQueries.createConversation(session.user.id, pageType, contextId, title);
    const conversation = chatQueries.findConversationById(result.lastInsertRowid);

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('创建对话失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
