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
    const [toggling, setToggling] = useState(false);

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

    const handleToggleFavorite = async () => {
        setToggling(true);
        try {
            await onToggleFavorite();
            // 等待 API 完成后重新检查状态
            await checkStatus();
        } finally {
            setToggling(false);
        }
    };

    const handleToggleTodo = async () => {
        setToggling(true);
        try {
            await onToggleTodo();
            // 等待 API 完成后重新检查状态
            await checkStatus();
        } finally {
            setToggling(false);
        }
    };

    if (loading) return null;

    return (
        <div className="favorite-todo-indicator">
            <button
                className={`indicator-btn ${isFavorited ? 'active' : ''}`}
                onClick={handleToggleFavorite}
                disabled={toggling}
                title={isFavorited ? '取消收藏' : '收藏'}
            >
                <span>{isFavorited ? '⭐' : '☆'}</span>
                <span>收藏</span>
            </button>
            <button
                className={`indicator-btn ${isTodo ? 'active' : ''}`}
                onClick={handleToggleTodo}
                disabled={toggling}
                title={isTodo ? '从待办移除' : '添加到待办'}
            >
                <span>{isTodo ? '📋' : '📝'}</span>
                <span>待办</span>
            </button>
        </div>
    );
}
