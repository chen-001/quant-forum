import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { codeVersionQueries } from '@/lib/db';

// GET /api/explore/versions/[id] - 获取单个版本详情
export async function GET(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id } = await params;
        const version = codeVersionQueries.getById(parseInt(id));

        if (!version) {
            return NextResponse.json({ error: '版本不存在' }, { status: 404 });
        }

        return NextResponse.json({ version });
    } catch (error) {
        console.error('获取版本详情失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH /api/explore/versions/[id] - 更新版本备注和标签
export async function PATCH(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { note, tags, isImportant } = body;

        const version = codeVersionQueries.getById(parseInt(id));
        if (!version) {
            return NextResponse.json({ error: '版本不存在' }, { status: 404 });
        }

        codeVersionQueries.updateNoteAndTags(parseInt(id), {
            note: note !== undefined ? note : version.note,
            tags: tags !== undefined ? tags : version.tags,
            isImportant: isImportant !== undefined ? isImportant : version.is_important
        });

        const updatedVersion = codeVersionQueries.getById(parseInt(id));

        return NextResponse.json({
            success: true,
            version: updatedVersion
        });
    } catch (error) {
        console.error('更新版本失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/explore/versions/[id] - 删除版本
export async function DELETE(request, { params }) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id } = await params;
        const version = codeVersionQueries.getById(parseInt(id));

        if (!version) {
            return NextResponse.json({ error: '版本不存在' }, { status: 404 });
        }

        codeVersionQueries.delete(parseInt(id));

        return NextResponse.json({
            success: true,
            message: '版本已删除'
        });
    } catch (error) {
        console.error('删除版本失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
