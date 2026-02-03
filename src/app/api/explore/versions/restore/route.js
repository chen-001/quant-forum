import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { codeVersionQueries, commentExplorationQueries } from '@/lib/db';

// POST /api/explore/versions/restore - 恢复到指定版本
export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { versionId } = body;

        if (!versionId) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        const version = codeVersionQueries.getById(parseInt(versionId));
        if (!version) {
            return NextResponse.json({ error: '版本不存在' }, { status: 404 });
        }

        // 获取当前的探索记录
        const exploration = commentExplorationQueries.getByCommentId(version.comment_id);
        if (!exploration) {
            return NextResponse.json({ error: '探索记录不存在' }, { status: 404 });
        }

        // 更新 variants
        const variants = exploration.user_modified_variants || exploration.variants;
        if (variants[version.variant_index]) {
            variants[version.variant_index] = {
                ...variants[version.variant_index],
                code: version.code,
                pseudocode: version.pseudocode,
                description: version.description
            };

            commentExplorationQueries.update(version.comment_id, {
                userModifiedVariants: variants
            });
        }

        // 创建一个新的版本记录（标记为恢复操作）
        const restoreResult = codeVersionQueries.create({
            commentId: version.comment_id,
            variantIndex: version.variant_index,
            code: version.code,
            pseudocode: version.pseudocode,
            description: version.description,
            note: `从版本 #${versionId} 恢复`,
            tags: null,
            isImportant: false,
            createdBy: session.user.id
        });

        return NextResponse.json({
            success: true,
            restoredVersion: version,
            newVersionId: restoreResult.lastInsertRowid
        });
    } catch (error) {
        console.error('恢复版本失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
