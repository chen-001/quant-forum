'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MarkdownRenderer, { MarkdownEditor } from '@/components/MarkdownRenderer';
import RatingPanel from '@/components/RatingPanel';

const MAX_OPEN_FRAMES = 4;

export default function PostDetailPage({ params }) {
    const { id } = use(params);
    const [post, setPost] = useState(null);
    const [ratings, setRatings] = useState(null);
    const [userRating, setUserRating] = useState(null);
    const [comments, setComments] = useState([]);
    const [userReactions, setUserReactions] = useState([]);
    const [results, setResults] = useState([]);
    const [openLinks, setOpenLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [newResult, setNewResult] = useState('');
    const [showResultForm, setShowResultForm] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchUser();
        fetchPost();
        fetchComments();
        fetchResults();
    }, [id]);

    const fetchUser = async () => {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        setUser(data.user);
    };

    const fetchPost = async () => {
        try {
            const res = await fetch(`/api/posts/${id}`);
            const data = await res.json();
            if (res.ok) {
                setPost(data.post);
                setRatings(data.ratings);
                setUserRating(data.userRating);
            }
        } catch (error) {
            console.error('Failed to fetch post:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async () => {
        try {
            const res = await fetch(`/api/posts/${id}/comments`);
            const data = await res.json();
            if (res.ok) {
                setComments(data.comments || []);
                setUserReactions(data.userReactions || []);
            }
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    };

    const fetchResults = async () => {
        try {
            const res = await fetch(`/api/posts/${id}/results`);
            const data = await res.json();
            if (res.ok) {
                setResults(data.results || []);
            }
        } catch (error) {
            console.error('Failed to fetch results:', error);
        }
    };

    const toggleLink = (link) => {
        const isOpen = openLinks.some(l => l.id === link.id);
        if (isOpen) {
            setOpenLinks(openLinks.filter(l => l.id !== link.id));
        } else if (openLinks.length < MAX_OPEN_FRAMES) {
            setOpenLinks([...openLinks, link]);
        }
    };

    const closeLink = (linkId) => {
        setOpenLinks(openLinks.filter(l => l.id !== linkId));
    };

    const handleCommentSubmit = async () => {
        if (!newComment.trim()) return;

        try {
            const res = await fetch(`/api/posts/${id}/comments`, {
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
                fetchComments();
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
        }
    };

    const handleReaction = async (commentId, reactionType) => {
        const hasReaction = userReactions.some(
            r => r.comment_id === commentId && r.reaction_type === reactionType
        );

        try {
            await fetch(`/api/posts/${id}/comments`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId,
                    reactionType,
                    action: hasReaction ? 'remove' : 'add'
                })
            });
            fetchComments();
        } catch (error) {
            console.error('Failed to react:', error);
        }
    };

    const handleResultSubmit = async () => {
        if (!newResult.trim()) return;

        try {
            const res = await fetch(`/api/posts/${id}/results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newResult })
            });

            if (res.ok) {
                setNewResult('');
                setShowResultForm(false);
                fetchResults();
            }
        } catch (error) {
            console.error('Failed to submit result:', error);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="loading" style={{ height: 'calc(100vh - 60px)' }}>
                    <div className="spinner"></div>
                </div>
            </>
        );
    }

    if (!post) {
        return (
            <>
                <Header />
                <div className="container">
                    <div className="empty-state">
                        <p>帖子不存在</p>
                    </div>
                </div>
            </>
        );
    }

    // 构建评论树
    const buildCommentTree = (comments) => {
        const map = {};
        const roots = [];

        comments.forEach(c => map[c.id] = { ...c, replies: [] });
        comments.forEach(c => {
            if (c.parent_id && map[c.parent_id]) {
                map[c.parent_id].replies.push(map[c.id]);
            } else {
                roots.push(map[c.id]);
            }
        });

        return roots;
    };

    const commentTree = buildCommentTree(comments);

    const renderComment = (comment, depth = 0) => (
        <div key={comment.id} className={`comment-item ${depth > 0 ? 'reply' : ''}`}>
            <div className="comment-header">
                <span className="comment-author">{comment.author_name}</span>
                <span className="comment-time">{formatDate(comment.created_at)}</span>
            </div>
            <div className="comment-content">
                <MarkdownRenderer content={comment.content} />
            </div>
            <div className="comment-actions">
                <button
                    className={`comment-action ${userReactions.some(r => r.comment_id === comment.id && r.reaction_type === 'like') ? 'active' : ''}`}
                    onClick={() => user && handleReaction(comment.id, 'like')}
                >
                    👍 {comment.likes_count}
                </button>
                <button
                    className={`comment-action ${userReactions.some(r => r.comment_id === comment.id && r.reaction_type === 'doubt') ? 'active' : ''}`}
                    onClick={() => user && handleReaction(comment.id, 'doubt')}
                >
                    🤔 质疑 {comment.doubts_count}
                </button>
                {user && (
                    <button
                        className="comment-action"
                        onClick={() => setReplyTo(comment)}
                    >
                        💬 回复
                    </button>
                )}
            </div>
            {comment.replies?.map(reply => renderComment(reply, depth + 1))}
        </div>
    );

    return (
        <>
            <Header />
            <main className="container">
                {/* 帖子标题 */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>
                            {post.title}
                        </h1>
                        {user && user.id === post.author_id && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a
                                    href={`/post/${id}/edit`}
                                    className="btn btn-secondary btn-sm"
                                >
                                    ✏️ 编辑帖子
                                </a>
                                <button
                                    className="btn btn-sm"
                                    style={{ background: 'var(--error)', color: 'white' }}
                                    onClick={async () => {
                                        if (confirm('确定要删除这篇帖子吗？此操作无法撤销。')) {
                                            try {
                                                const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
                                                if (res.ok) {
                                                    router.push('/');
                                                } else {
                                                    const data = await res.json();
                                                    alert(data.error || '删除失败');
                                                }
                                            } catch (error) {
                                                alert('删除失败，请重试');
                                            }
                                        }
                                    }}
                                >
                                    🗑️ 删除帖子
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        👤 {post.author_name} · 📅 {formatDate(post.created_at)}
                    </div>
                </div>

                {/* 正文内容 */}
                {post.content && (
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <MarkdownRenderer content={post.content} />
                    </div>
                )}

                {/* 主体布局：预览区 + 讨论区 */}
                <div className="post-detail">
                    <div className="post-main">
                        {/* 网页预览区 */}
                        <div className="preview-section">
                            <div className="preview-header">
                                <h3 className="preview-title">🔗 AI对话链接</h3>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                    点击链接展开预览（最多{MAX_OPEN_FRAMES}个）
                                </span>
                            </div>

                            {/* 链接选择 */}
                            <div className="link-chips">
                                {post.links?.map((link) => {
                                    const isOpen = openLinks.some(l => l.id === link.id);
                                    return (
                                        <div
                                            key={link.id}
                                            className={`link-chip ${isOpen ? 'active' : ''}`}
                                            onClick={() => toggleLink(link)}
                                        >
                                            <span>{link.title || `链接 ${link.order_num + 1}`}</span>
                                            {isOpen && (
                                                <span
                                                    className="link-chip-close"
                                                    onClick={(e) => { e.stopPropagation(); closeLink(link.id); }}
                                                >
                                                    ✕
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* iframe预览 */}
                            {openLinks.length > 0 ? (
                                <div className={`preview-frames ${openLinks.length > 1 ? 'multi-frame' : ''}`}>
                                    {openLinks.map((link) => (
                                        <div key={link.id} className="preview-frame">
                                            <div className="preview-frame-header">
                                                <span className="preview-frame-url" title={link.url}>
                                                    {link.title || link.url}
                                                </span>
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    ↗ 新窗口
                                                </a>
                                            </div>
                                            <iframe
                                                src={link.url}
                                                className="preview-iframe"
                                                sandbox="allow-scripts allow-same-origin allow-popups"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                            <div className="preview-blocked" style={{ display: 'none' }}>
                                                <p>⚠️ 该网站禁止嵌入显示</p>
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-primary"
                                                    style={{ marginTop: '16px' }}
                                                >
                                                    在新窗口打开
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: '48px' }}>
                                    <p>👆 点击上方链接以展开预览</p>
                                </div>
                            )}
                        </div>

                        {/* 成果记录区 */}
                        <div className="results-section">
                            <div className="results-header">
                                <h3 className="results-title">🏆 成果记录</h3>
                                {user && (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => setShowResultForm(!showResultForm)}
                                    >
                                        {showResultForm ? '取消' : '+ 添加成果'}
                                    </button>
                                )}
                            </div>

                            {showResultForm && (
                                <div style={{ marginBottom: '16px' }}>
                                    <MarkdownEditor
                                        value={newResult}
                                        onChange={setNewResult}
                                        placeholder="记录这个想法的最终成果，支持Markdown..."
                                        minHeight={150}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginTop: '8px' }}
                                        onClick={handleResultSubmit}
                                    >
                                        保存成果
                                    </button>
                                </div>
                            )}

                            {results.length === 0 ? (
                                <div className="empty-state" style={{ padding: '32px' }}>
                                    <p>暂无成果记录</p>
                                </div>
                            ) : (
                                <div className="results-list">
                                    {results.map(result => (
                                        <div key={result.id} className="result-item">
                                            <div className="result-meta">
                                                <span>👤 {result.author_name}</span>
                                                <span>📅 {formatDate(result.created_at)}</span>
                                            </div>
                                            <MarkdownRenderer content={result.content} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 评分区 */}
                        <RatingPanel
                            postId={id}
                            averages={ratings}
                            userRating={userRating}
                            onUpdate={(newRatings) => setRatings(newRatings)}
                        />
                    </div>

                    {/* 想法讨论区（侧边栏） */}
                    <div className="post-sidebar">
                        <div className="discussion-section">
                            <div className="discussion-header">
                                💬 想法讨论区 ({comments.length})
                            </div>

                            <div className="comments-list">
                                {commentTree.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '24px' }}>
                                        <p>还没有评论，来发表第一条吧！</p>
                                    </div>
                                ) : (
                                    commentTree.map(comment => renderComment(comment))
                                )}
                            </div>

                            {user ? (
                                <div className="comment-input-container">
                                    {replyTo && (
                                        <div style={{
                                            padding: '8px',
                                            marginBottom: '8px',
                                            background: 'var(--primary-light)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '13px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span>回复 @{replyTo.author_name}</span>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setReplyTo(null)}
                                            >
                                                取消
                                            </button>
                                        </div>
                                    )}
                                    <MarkdownEditor
                                        value={newComment}
                                        onChange={setNewComment}
                                        placeholder="写下你的想法，支持Markdown..."
                                        minHeight={80}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginTop: '8px', width: '100%' }}
                                        onClick={handleCommentSubmit}
                                        disabled={!newComment.trim()}
                                    >
                                        发表评论
                                    </button>
                                </div>
                            ) : (
                                <div className="comment-input-container" style={{ textAlign: 'center' }}>
                                    <a href="/login" className="btn btn-primary">
                                        登录后参与讨论
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
