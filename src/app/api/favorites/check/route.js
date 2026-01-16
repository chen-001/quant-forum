import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookies } from '@/lib/session';
import { favoriteQueries } from '@/lib/db';

// GET /api/favorites/check - 检查是否已收藏
export async function GET(request) {
    try {
        const session = await getSessionFromCookies(await cookies());
        if (!session.user) {
            return NextResponse.json({ isFavorited: false });
        }

        const { searchParams } = new URL(request.url);
        const contentType = searchParams.get('contentType');
        const postId = searchParams.get('postId');
        const commentId = searchParams.get('commentId');
        const resultId = searchParams.get('resultId');

        const isFavorited = favoriteQueries.checkIfExists({
            userId: session.user.id,
            contentType,
            postId: parseInt(postId),
            commentId: commentId ? parseInt(commentId) : null,
            resultId: resultId ? parseInt(resultId) : null
        });

        return NextResponse.json({ isFavorited });
    } catch (error) {
        console.error('Check favorite error:', error);
        return NextResponse.json({ isFavorited: false });
    }
}
