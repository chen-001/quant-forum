import { readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import {
    getContentTypeByFilename,
    resolveStoredUploadPath,
    sanitizeUploadFilename
} from '@/lib/upload-storage';

export async function GET(request, { params }) {
    try {
        const { filename } = await params;
        const safeFilename = sanitizeUploadFilename(filename);

        if (!safeFilename) {
            return NextResponse.json({ error: '无效文件名' }, { status: 400 });
        }

        const filepath = resolveStoredUploadPath(safeFilename);
        if (!filepath) {
            return NextResponse.json({ error: '文件不存在' }, { status: 404 });
        }

        const fileBuffer = await readFile(filepath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': getContentTypeByFilename(safeFilename),
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Read upload file error:', error);
        return NextResponse.json({ error: '读取文件失败' }, { status: 500 });
    }
}
