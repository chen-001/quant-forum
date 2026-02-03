import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { codeVersionQueries } from '@/lib/db';
import { diffLines } from 'diff';

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

// GET /api/explore/versions/diff?versionId1=xxx&versionId2=xxx - 获取两个版本的diff
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const versionId1 = searchParams.get('versionId1');
        const versionId2 = searchParams.get('versionId2');

        if (!versionId1 || !versionId2) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        const versions = codeVersionQueries.getTwoVersions(
            parseInt(versionId1),
            parseInt(versionId2)
        );

        if (versions.length !== 2) {
            return NextResponse.json({ error: '版本不存在' }, { status: 404 });
        }

        const [oldVersion, newVersion] = versions;

        // 计算代码diff
        const codeDiff = diffLines(oldVersion.code, newVersion.code);
        // 计算伪代码diff
        const pseudocodeDiff = diffLines(oldVersion.pseudocode, newVersion.pseudocode);

        return NextResponse.json({
            oldVersion: {
                id: oldVersion.id,
                createdAt: toShanghaiTime(oldVersion.created_at),
                createdBy: oldVersion.created_by_name,
                note: oldVersion.note,
                tags: oldVersion.tags,
                isImportant: oldVersion.is_important,
                code: oldVersion.code,
                pseudocode: oldVersion.pseudocode,
                description: oldVersion.description
            },
            newVersion: {
                id: newVersion.id,
                createdAt: toShanghaiTime(newVersion.created_at),
                createdBy: newVersion.created_by_name,
                note: newVersion.note,
                tags: newVersion.tags,
                isImportant: newVersion.is_important,
                code: newVersion.code,
                pseudocode: newVersion.pseudocode,
                description: newVersion.description
            },
            codeDiff: codeDiff.map(part => ({
                value: part.value,
                added: part.added || false,
                removed: part.removed || false
            })),
            pseudocodeDiff: pseudocodeDiff.map(part => ({
                value: part.value,
                added: part.added || false,
                removed: part.removed || false
            }))
        });
    } catch (error) {
        console.error('获取版本diff失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
