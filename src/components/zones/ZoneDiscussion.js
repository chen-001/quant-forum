'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarkdownEditor } from '@/components/MarkdownRenderer';
import InteractiveMarkdownRenderer from '@/components/InteractiveMarkdownRenderer';

export default function ZoneDiscussion({ pageId, user }) {
    const [discussions, setDiscussions] = useState([]);
    const [userReactions, setUserReactions] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const fetchDiscussions = useCallback(async () => {
        if (!pageId) return;
        
        try {
            const res = await fetch(`/api/zones/pages/${pageId}/discussions?tree=1`);
            const data = await res.json();
            if (res.ok) {
                setDiscussions(data.discussions || []);
                setUserReactions(data.userReactions || []);
            }
        } catch (error) {
            console.error('Failed to fetch discussions:', error);
        } finally {
            setLoading(false);
        }
    }, [pageId]);

    useEffect(() => {
        fetchDiscussions();
    }, [fetchDiscussions]);

    const handleSubmit = async () => {
        if (!newComment.trim() || !user) return;

        try {
            const res = await fetch(`/api/zones/pages/${pageId}/discussions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newComment,
                    parentId: replyTo?.id || null
                })
            });

            if (res.ok) {
                setNewComment('');
                setReplyTo(null);
                fetchDiscussions();
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
        }
    };

    const handleEdit = async (discussionId) => {
        if (!editContent.trim()) return;

        try {
            const res = await fetch(`/api/zones/pages/${pageId}/discussions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discussionId,
                    content: editContent
                })
            });

            if (res.ok) {
                setEditingId(null);
                setEditContent('');
                fetchDiscussions();
            }
        } catch (error) {
            console.error('Failed to edit comment:', error);
        }
    };

    const handleDelete = async (discussionId) => {
        if (!confirm('确定要删除这条评论吗？')) return;

        try {
            const res = await fetch(`/api/zones/pages/${pageId}/discussions?discussionId=${discussionId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchDiscussions();
            }
        } catch (error) {
            console.error('Failed to delete comment:', error);
        }
    };

    const handleReaction = async (discussionId, reactionType) => {
        if (!user) return;

        const hasReaction = userReactions.some(
            r => r.discussion_id === discussionId && r.reaction_type === reactionType
        );

        try {
            await fetch(`/api/zones/pages/${pageId}/discussions`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discussionId,
                    reactionType,
                    action: hasReaction ? 'remove' : 'add'
                })
            });
            fetchDiscussions();
        } catch (error) {
            console.error('Failed to react:', error);
        }
    };

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

    // 过滤评论
    const filterDiscussions = (items) => {
        if (!filter.trim()) return items;
        
        const lowerFilter = filter.toLowerCase();
        const matches = (item) => {
            return item.author_name.toLowerCase().includes(lowerFilter) ||
                   item.content.toLowerCase().includes(lowerFilter);
        };

        return items
            .map(item => ({
                ...item,
                replies: filterDiscussions(item.replies || [])
            }))
            .filter(item => matches(item) || item.replies.length > 0);
    };

    const filteredDiscussions = filterDiscussions(discussions);

    const renderDiscussion = (item, depth = 0) => (
        <div key={item.id} className={`zone-discussion-item ${depth > 0 ? 'reply' : ''}`}>
            <div className="zone-discussion-header">
                <span className="zone-discussion-author">{item.author_name}</span>
                <span className="zone-discussion-time">{formatDate(item.created_at)}</span>
            </div>
            
            {editingId === item.id ? (
                <div className="zone-discussion-edit">
                    <MarkdownEditor
                        value={editContent}
                        onChange={setEditContent}
                        placeholder="编辑评论..."
                        minHeight={80}
                    />
                    <div className="zone-discussion-edit-actions">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleEdit(item.id)}
                            disabled={!editContent.trim()}
                        >
                            保存
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                setEditingId(null);
                                setEditContent('');
                            }}
                        >
                            取消
                        </button>
                    </div>
                </div>
            ) : (
                <div className="zone-discussion-content">
                    <InteractiveMarkdownRenderer
                        contentType="zone_discussion"
                        postId={pageId}
                        commentId={item.id.toString()}
                        content={item.content}
                        user={user}
                    />
                </div>
            )}
            
            <div className="zone-discussion-actions">
                <button
                    className={`zone-discussion-action ${userReactions.some(r => r.discussion_id === item.id && r.reaction_type === 'like') ? 'active' : ''}`}
                    onClick={() => user && handleReaction(item.id, 'like')}
                    data-count={item.likes_count}
                >
                    <span className="emoji">👍</span>
                    <span className="label">点赞</span>
                </button>
                <button
                    className={`zone-discussion-action ${userReactions.some(r => r.discussion_id === item.id && r.reaction_type === 'doubt') ? 'active' : ''}`}
                    onClick={() => user && handleReaction(item.id, 'doubt')}
                    data-count={item.doubts_count}
                >
                    <span className="emoji">🤔</span>
                    <span className="label">质疑</span>
                </button>
                {user && (
                    <button
                        className="zone-discussion-action"
                        onClick={() => setReplyTo(item)}
                    >
                        <span className="emoji">💬</span>
                        <span className="label">回复</span>
                    </button>
                )}
                {user && user.id === item.author_id && editingId !== item.id && (
                    <>
                        <button
                            className="zone-discussion-action"
                            onClick={() => {
                                setEditingId(item.id);
                                setEditContent(item.content);
                            }}
                        >
                            <span className="emoji">✏️</span>
                            <span className="label">编辑</span>
                        </button>
                        <button
                            className="zone-discussion-action danger"
                            onClick={() => handleDelete(item.id)}
                        >
                            <span className="emoji">🗑️</span>
                            <span className="label">删除</span>
                        </button>
                    </>
                )}
            </div>
            
            {item.replies?.map(reply => renderDiscussion(reply, depth + 1))}
        </div>
    );

    if (loading) {
        return (
            <div className="zone-discussion-loading">
                <div className="spinner" style={{ width: 24, height: 24 }}></div>
            </div>
        );
    }

    return (
        <div className="zone-discussion">
            <div className="zone-discussion-header">
                <h3>💬 想法讨论区</h3>
                <div className="zone-discussion-filter">
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="筛选评论..."
                    />
                </div>
            </div>

            <div className="zone-discussion-list">
                {filteredDiscussions.length === 0 ? (
                    <div className="zone-discussion-empty">
                        {filter ? '没有找到匹配的评论' : '暂无评论，来发表第一个想法吧！'}
                    </div>
                ) : (
                    filteredDiscussions.map(item => renderDiscussion(item))
                )}
            </div>

            {user && (
                <div className="zone-discussion-input">
                    {replyTo && (
                        <div className="zone-discussion-reply-to">
                            <span>回复 {replyTo.author_name}</span>
                            <button onClick={() => setReplyTo(null)}>取消</button>
                        </div>
                    )}
                    <MarkdownEditor
                        value={newComment}
                        onChange={setNewComment}
                        placeholder={replyTo ? `回复 ${replyTo.author_name}...` : '发表你的想法...'}
                        minHeight={100}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={!newComment.trim()}
                    >
                        发表
                    </button>
                </div>
            )}
        </div>
    );
}
