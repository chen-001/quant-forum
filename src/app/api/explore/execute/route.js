import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { executePythonCode } from '@/lib/code-executor';
import { commentExplorationQueries } from '@/lib/db';

// POST /api/explore/execute - 执行代码
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { code, stockCode, date, commentId, variantIndex } = body;

        if (!code || !stockCode || !date) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        // 执行代码
        const result = await executePythonCode(code, stockCode, date);

        // 如果提供了commentId，保存执行结果
        if (commentId && variantIndex !== undefined) {
            try {
                const exploration = commentExplorationQueries.getByCommentId(parseInt(commentId));
                if (exploration) {
                    const executionResults = exploration.execution_results || {};
                    executionResults[String(variantIndex)] = {
                        success: result.success,
                        factors: result.factors,
                        keyVariables: result.keyVariables,
                        error: result.error,
                        traceback: result.traceback,
                        executedAt: new Date().toISOString()
                    };

                    commentExplorationQueries.update(parseInt(commentId), {
                        executionResults,
                        lastExecutedVariant: variantIndex,
                        lastStockCode: stockCode,
                        lastDate: parseInt(date)
                    });
                }
            } catch (saveError) {
                console.error('保存执行结果失败:', saveError);
            }
        }

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
