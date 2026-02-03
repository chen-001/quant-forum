import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { executePythonCode } from '@/lib/code-executor';
import { commentExplorationQueries, getDb, activityLogQueries } from '@/lib/db';

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

                    // 记录动态 - 获取评论和帖子信息
                    try {
                        const db = getDb();
                        const commentInfoStmt = db.prepare(`
                            SELECT c.id as comment_id, c.author_id as comment_author_id, c.post_id, p.title as post_title
                            FROM comments c
                            JOIN posts p ON c.post_id = p.id
                            WHERE c.id = ?
                        `);
                        const commentInfo = commentInfoStmt.get(commentId);
                        
                        if (commentInfo) {
                            const variants = exploration.user_modified_variants || exploration.variants;
                            const variantName = variants?.[variantIndex]?.name || `方案${variantIndex + 1}`;
                            
                            activityLogQueries.create({
                                category: 'exploration',
                                action: 'exploration_code_executed',
                                actorId: session.user.id,
                                relatedUserId: commentInfo.comment_author_id,
                                postId: commentInfo.post_id,
                                commentId: commentInfo.comment_id,
                                meta: JSON.stringify({
                                    postTitle: commentInfo.post_title,
                                    variantIndex: variantIndex,
                                    variantName: variantName,
                                    stockCode: stockCode,
                                    date: date,
                                    success: result.success
                                })
                            });
                        }
                    } catch (logError) {
                        console.error('记录探索动态失败:', logError);
                    }
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
