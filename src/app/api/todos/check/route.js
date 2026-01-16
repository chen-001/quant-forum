import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { todoQueries } from '@/lib/db';

// GET /api/todos/check - 检查是否已添加待办
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ isTodo: false });
        }

        const { searchParams } = new URL(request.url);
        const contentType = searchParams.get('contentType');
        const postId = searchParams.get('postId');
        const commentId = searchParams.get('commentId');
        const resultId = searchParams.get('resultId');

        const isTodo = todoQueries.checkIfExists({
            userId: session.user.id,
            contentType,
            postId: parseInt(postId),
            commentId: commentId ? parseInt(commentId) : null,
            resultId: resultId ? parseInt(resultId) : null
        });

        return NextResponse.json({ isTodo });
    } catch (error) {
        console.error('Check todo error:', error);
        return NextResponse.json({ isTodo: false });
    }
}
