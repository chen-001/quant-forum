import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { codeVersionQueries, getDb, activityLogQueries } from '@/lib/db';

// 将 UTC 时间字符串转换为东八区时间字符串
function toShanghaiTime(utcDateString) {
    if (!utcDateString) return '';
    const date = new Date(utcDateString + 'Z'); // 添加 Z 表示 UTC 时间
    return date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// GET /api/explore/versions?commentId=xxx&variantIndex=0 - 获取版本列表
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('commentId');
        const variantIndex = searchParams.get('variantIndex');

        if (!commentId || variantIndex === null) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        const versions = codeVersionQueries.listByCommentAndVariant(
            parseInt(commentId),
            parseInt(variantIndex)
        );

        // 转换时间为东八区
        const versionsWithShanghaiTime = versions.map(v => ({
            ...v,
            created_at: toShanghaiTime(v.created_at)
        }));

        return NextResponse.json({ versions: versionsWithShanghaiTime });
    } catch (error) {
        console.error('获取版本列表失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/explore/versions - 创建新版本
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { commentId, variantIndex, code, pseudocode, description, note, tags, isImportant } = body;

        if (!commentId || variantIndex === undefined || !code || pseudocode === undefined) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        // 创建新版本
        const result = codeVersionQueries.create({
            commentId: parseInt(commentId),
            variantIndex: parseInt(variantIndex),
            code,
            pseudocode,
            description: description || '',
            note: note || null,
            tags: tags || null,
            isImportant: isImportant || false,
            createdBy: session.user.id
        });

        // 清理旧版本（保留最近20个非重要版本）
        const deletedCount = codeVersionQueries.cleanupOldVersions(
            parseInt(commentId),
            parseInt(variantIndex),
            20
        );

        if (deletedCount > 0) {
            console.log(`清理了 ${deletedCount} 个旧版本`);
        }

        const newVersion = codeVersionQueries.getById(result.lastInsertRowid);

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
                activityLogQueries.create({
                    category: 'exploration',
                    action: 'exploration_version_saved',
                    actorId: session.user.id,
                    relatedUserId: commentInfo.comment_author_id,
                    postId: commentInfo.post_id,
                    commentId: commentInfo.comment_id,
                    meta: JSON.stringify({
                        postTitle: commentInfo.post_title,
                        variantIndex: variantIndex,
                        variantName: description?.slice(0, 50) || `方案${parseInt(variantIndex) + 1}`,
                        versionId: result.lastInsertRowid,
                        isImportant: isImportant || false,
                        note: note?.slice(0, 100)
                    })
                });
            }
        } catch (logError) {
            console.error('记录探索动态失败:', logError);
        }

        // 转换时间为东八区
        const versionWithShanghaiTime = {
            ...newVersion,
            created_at: toShanghaiTime(newVersion.created_at)
        };

        return NextResponse.json({
            success: true,
            version: versionWithShanghaiTime,
            deletedCount
        });
    } catch (error) {
        console.error('创建版本失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
