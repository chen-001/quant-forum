import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { executePythonCode } from '@/lib/code-executor';

// POST /api/explore/execute - 执行代码
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { code, stockCode, date } = body;

        if (!code || !stockCode || !date) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        // 执行代码
        const result = await executePythonCode(code, stockCode, date);

        return NextResponse.json(result);
    } catch (error) {
        console.error('执行代码失败:', error);
        return NextResponse.json({
            error: error.message,
            stdout: '',
            stderr: error.message
        }, { status: 500 });
    }
}
