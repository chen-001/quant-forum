import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
    try {
        const session = await getSessionFromCookies(await cookies());

        if (!session.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: '没有上传文件' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 生成唯一文件名
        const ext = path.extname(file.name);
        const filename = `${uuidv4()}${ext}`;

        // 确保上传目录存在
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        // 保存文件
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);

        // 返回文件URL
        const fileUrl = `/uploads/${filename}`;

        return NextResponse.json({
            url: fileUrl,
            filename: file.name
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: '上传失败' }, { status: 500 });
    }
}
