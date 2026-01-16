'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Link from 'next/link';

export default function FavoritesPage() {
    const [favorites, setFavorites] = useState([]);
    const [filter, setFilter] = useState('all');
    const [scope, setScope] = useState('mine');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFavorites();
    }, [filter, scope]);

    // 当 scope 变为 'mine' 时，重置选中的用户
    useEffect(() => {
        if (scope === 'mine') {
            setSelectedUserId(null);
        }
    }, [scope]);

    const fetchFavorites = async () => {
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') {
                params.append('contentType', filter);
            }
            params.append('scope', scope);

            const url = `/api/favorites?${params.toString()}`;

            const res = await fetch(url);
            const data = await res.json();

            if (res.ok) {
                setFavorites(data.favorites || []);
                // 默认选中第一个用户（在"大家的"模式下）
                if (scope === 'all' && data.favorites && data.favorites.length > 0 && !selectedUserId) {
                    setSelectedUserId(data.favorites[0].favorite_author_id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch favorites:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这个收藏吗？')) return;

        try {
            const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });

            if (res.ok) {
                setFavorites(favorites.filter(f => f.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete favorite:', error);
        }
    };

    const handleToggleVisibility = async (id, currentVisibility) => {
        const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
        try {
            const res = await fetch(`/api/favorites/${id}/visibility`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visibility: newVisibility })
            });

            if (res.ok) {
                setFavorites(favorites.map(f =>
                    f.id === id ? { ...f, visibility: newVisibility } : f
                ));
                alert(newVisibility === 'public' ? '已设为公开' : '已设为私密');
            } else {
                const data = await res.json();
                alert(data.error || '更新失败');
            }
        } catch (error) {
            console.error('Failed to update visibility:', error);
            alert('更新失败，请重试');
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'Z'); // 确保解析为UTC时间
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Shanghai'
        });
    };

    const renderContent = (favorite) => {
        switch (favorite.content_type) {
            case 'post':
                return (
                    <div>
                        <Link href={`/post/${favorite.post_id}`} className="favorite-post-title">
                            <h3>{favorite.post_title}</h3>
                        </Link>
                        <div className="favorite-meta">
                            <span>👤 {favorite.post_author_name}</span>
                            <span>📅 {formatDate(favorite.created_at)}</span>
                        </div>
                    </div>
                );

            case 'comment':
                return (
                    <div>
                        <Link href={`/post/${favorite.post_id}`} className="favorite-post-title">
                            <h4>{favorite.post_title}</h4>
                        </Link>
                        <div className="favorite-comment">
                            <MarkdownRenderer content={favorite.comment_content} />
                        </div>
                        <div className="favorite-meta">
                            <span>💬 {favorite.comment_author_name}</span>
                            <span>📅 {formatDate(favorite.created_at)}</span>
                        </div>
                    </div>
                );

            case 'result':
                return (
                    <div>
                        <Link href={`/post/${favorite.post_id}`} className="favorite-post-title">
                            <h4>{favorite.post_title}</h4>
                        </Link>
                        <div className="favorite-result">
                            <MarkdownRenderer content={favorite.result_content} />
                        </div>
                        <div className="favorite-meta">
                            <span>🏆 {favorite.result_author_name}</span>
                            <span>📅 {formatDate(favorite.created_at)}</span>
                        </div>
                    </div>
                );

            case 'text_selection':
                return (
                    <div>
                        <Link href={`/post/${favorite.post_id}`} className="favorite-post-title">
                            <h4>{favorite.post_title}</h4>
                        </Link>
                        <div className="favorite-text-selection">
                            <p>"{favorite.text_data}"</p>
                            {favorite.line_index !== null && (
                                <span className="line-info">第 {favorite.line_index + 1} 行</span>
                            )}
                        </div>
                        <div className="favorite-meta">
                            <span>📅 {formatDate(favorite.created_at)}</span>
                        </div>
                    </div>
                );

            case 'image':
                return (
                    <div>
                        <Link href={`/post/${favorite.post_id}`} className="favorite-post-title">
                            <h4>{favorite.post_title}</h4>
                        </Link>
                        <div className="favorite-image">
                            <img src={favorite.image_url} alt="收藏的图片" />
                        </div>
                        <div className="favorite-meta">
                            <span>📅 {formatDate(favorite.created_at)}</span>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const getFilterLabel = (type) => {
        const labels = {
            all: '全部',
            post: '帖子',
            comment: '评论',
            result: '成果',
            text_selection: '文字',
            image: '图片',
            idea: '想法'
        };
        return labels[type] || type;
    };

    // 获取唯一的用户列表（用于"大家的"模式）
    const getUniqueUsers = () => {
        const userMap = new Map();
        favorites.forEach(fav => {
            if (fav.favorite_author_id && fav.favorite_author_name) {
                userMap.set(fav.favorite_author_id, fav.favorite_author_name);
            }
        });
        return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
    };

    // 根据选中的用户过滤收藏
    const getFilteredFavorites = () => {
        if (scope === 'mine' || !selectedUserId) {
            return favorites;
        }
        return favorites.filter(fav => fav.favorite_author_id === selectedUserId);
    };

    const uniqueUsers = getUniqueUsers();
    const displayedFavorites = getFilteredFavorites();

    return (
        <>
            <Header />
            <main className="container">
                <div className="favorites-page">
                    <div className="favorites-header">
                        <h1>⭐ 我的收藏</h1>
                        <div className="scope-tabs">
                            <button
                                className={scope === 'mine' ? 'active' : ''}
                                onClick={() => setScope('mine')}
                            >
                                我的
                            </button>
                            <button
                                className={scope === 'all' ? 'active' : ''}
                                onClick={() => setScope('all')}
                            >
                                大家的
                            </button>
                        </div>
                        <div className="favorites-filter">
                            {['all', 'post', 'comment', 'result', 'text_selection', 'image'].map(type => (
                                <button
                                    key={type}
                                    className={filter === type ? 'active' : ''}
                                    onClick={() => setFilter(type)}
                                >
                                    {getFilterLabel(type)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 在"大家的"模式下显示用户标签页 */}
                    {scope === 'all' && uniqueUsers.length > 0 && (
                        <div className="user-tabs" style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {uniqueUsers.map(user => (
                                <button
                                    key={user.id}
                                    className={selectedUserId === user.id ? 'btn-primary' : 'btn-ghost'}
                                    style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px' }}
                                    onClick={() => setSelectedUserId(user.id)}
                                >
                                    {user.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="loading">
                            <div className="spinner"></div>
                        </div>
                    ) : displayedFavorites.length === 0 ? (
                        <div className="empty-state">
                            <p>还没有收藏，右键点击内容可以收藏</p>
                        </div>
                    ) : (
                        <div className="favorites-list">
                            {displayedFavorites.map(favorite => (
                                <div key={favorite.id} className="favorite-item">
                                    <div className="favorite-content">
                                        {renderContent(favorite)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {scope === 'mine' && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleToggleVisibility(favorite.id, favorite.visibility || 'public')}
                                                title={(favorite.visibility || 'public') === 'public' ? '设为仅自己可见' : '设为所有人可见'}
                                            >
                                                {(favorite.visibility || 'public') === 'public' ? '🌐 公开' : '🔒 私密'}
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(favorite.id)}
                                            title="删除收藏"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
