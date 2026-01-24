'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'Z');
    return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai'
    });
};

const getActionLabel = (activity) => {
    const actionMap = {
        post_updated: '更新了帖子正文',
        post_link_added: '添加了帖子链接',
        comment_created: '发表了评论',
        comment_reply_created: '回复了评论',
        comment_liked: '点赞了评论',
        comment_doubted: '质疑了评论',
        post_idea_updated: '更新了想法区',
        post_result_created: '新增了成果展示',
        post_table_updated: '更新了表格内容',
        line_comment_created: '添加了行内评论',
        favorite_added: '添加了收藏',
        favorite_removed: '取消了收藏',
        todo_added: '添加了待办',
        todo_removed: '移除了待办',
        todo_completed: '完成了待办',
        todo_reopened: '重新打开待办',
        todo_note_updated: '更新了待办说明',
        todo_transferred: '流转了待办',
        summary_field_updated: '编辑了摘要字段',
        summary_batch_updated: '批量编辑了摘要'
    };
    return actionMap[activity.action] || activity.action;
};

const getSummaryText = (activity) => {
    if (activity.meta?.postTitle || activity.post_title) {
        return activity.meta?.postTitle || activity.post_title;
    }
    if (activity.meta?.contentType) {
        return `内容类型: ${activity.meta.contentType}`;
    }
    if (activity.meta?.field) {
        return `字段: ${activity.meta.field}`;
    }
    if (activity.meta?.fields) {
        return `字段: ${activity.meta.fields.join(', ')}`;
    }
    return '';
};

const getActivityHref = (activity) => {
    if (activity.category === 'summary') {
        if (activity.post_id) {
            return `/post/${activity.post_id}`;
        }
        return '/summaries';
    }

    if (activity.category === 'favorites_todos') {
        if (activity.action?.startsWith('favorite')) {
            return '/favorites';
        }
        return '/todos';
    }

    if (activity.post_id) {
        return `/post/${activity.post_id}`;
    }

    return null;
};

export default function ActivitiesPage() {
    const [scope, setScope] = useState('all');
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);

    const fetchActivities = async (nextScope = scope, nextOffset = 0, append = false) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                scope: nextScope,
                limit: '20',
                offset: String(nextOffset)
            });
            const res = await fetch(`/api/activities?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setTotal(data.total || 0);
                if (append) {
                    setActivities(prev => [...prev, ...(data.activities || [])]);
                } else {
                    setActivities(data.activities || []);
                }
                await fetch('/api/activities/seen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scope: nextScope })
                });
                window.dispatchEvent(new Event('activities:seen'));
            }
        } catch (error) {
            console.error('Failed to fetch activities:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setOffset(0);
        fetchActivities(scope, 0, false);
    }, [scope]);

    const handleLoadMore = () => {
        const nextOffset = offset + 20;
        setOffset(nextOffset);
        fetchActivities(scope, nextOffset, true);
    };

    return (
        <>
            <Header />
            <main className="container">
                <div style={{ marginTop: '24px' }}>
                    <h1>最新动态</h1>
                    <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
                        <button
                            className={scope === 'all' ? 'btn btn-primary' : 'btn btn-ghost'}
                            onClick={() => setScope('all')}
                        >
                            全站
                        </button>
                        <button
                            className={scope === 'related' ? 'btn btn-primary' : 'btn btn-ghost'}
                            onClick={() => setScope('related')}
                        >
                            与我相关
                        </button>
                    </div>

                    {loading && activities.length === 0 ? (
                        <div className="loading">
                            <div className="spinner"></div>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="empty-state">
                            <p>暂无动态</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {activities.map(activity => {
                                const href = getActivityHref(activity);
                                const content = (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>
                                                {activity.actor_name || '系统'} {getActionLabel(activity)}
                                            </div>
                                            {getSummaryText(activity) && (
                                                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    {getSummaryText(activity)}
                                                </div>
                                            )}
                                            {activity.related_user_name && scope === 'all' && (
                                                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    关联用户: {activity.related_user_name}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            {formatDate(activity.created_at)}
                                        </div>
                                    </div>
                                );

                                if (!href) {
                                    return (
                                        <div key={activity.id} className="card">
                                            {content}
                                        </div>
                                    );
                                }

                                return (
                                    <Link key={activity.id} href={href} className="card" style={{ textDecoration: 'none' }}>
                                        {content}
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {activities.length < total && (
                        <div style={{ marginTop: '16px' }}>
                            <button className="btn btn-ghost" onClick={handleLoadMore} disabled={loading}>
                                {loading ? '加载中...' : '加载更多'}
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
