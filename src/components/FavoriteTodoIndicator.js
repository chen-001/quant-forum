'use client';

import { useState, useEffect } from 'react';

export default function FavoriteTodoIndicator({
    contentType,
    postId,
    commentId,
    resultId,
    onToggleFavorite,
    onToggleTodo
}) {
    const [isFavorited, setIsFavorited] = useState(false);
    const [isTodo, setIsTodo] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkStatus();
    }, [contentType, postId, commentId, resultId]);

    const checkStatus = async () => {
        try {
            const params = new URLSearchParams({
                contentType,
                postId: postId.toString()
            });
            if (commentId) params.append('commentId', commentId.toString());
            if (resultId) params.append('resultId', resultId.toString());

            const [favRes, todoRes] = await Promise.all([
                fetch(`/api/favorites/check?${params.toString()}`),
                fetch(`/api/todos/check?${params.toString()}`)
            ]);

            const favData = await favRes.json();
            const todoData = await todoRes.json();

            setIsFavorited(favData.isFavorited);
            setIsTodo(todoData.isTodo);
        } catch (error) {
            console.error('Failed to check status:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    return (
        <div className="favorite-todo-indicator">
            <button
                className={`indicator-btn ${isFavorited ? 'active' : ''}`}
                onClick={() => {
                    onToggleFavorite();
                    setIsFavorited(!isFavorited);
                }}
                title={isFavorited ? '取消收藏' : '收藏'}
            >
                {isFavorited ? '⭐' : '☆'}
            </button>
            <button
                className={`indicator-btn ${isTodo ? 'active' : ''}`}
                onClick={() => {
                    onToggleTodo();
                    setIsTodo(!isTodo);
                }}
                title={isTodo ? '从待办移除' : '添加到待办'}
            >
                {isTodo ? '📋' : '📝'}
            </button>
        </div>
    );
}
