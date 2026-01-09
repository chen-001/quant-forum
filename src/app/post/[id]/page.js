'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MarkdownRenderer, { MarkdownEditor } from '@/components/MarkdownRenderer';
import RatingPanel from '@/components/RatingPanel';
import TableEditor from '@/components/TableEditor';
import InteractiveContent from '@/components/InteractiveContent';

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
    const [tableSaveStatus, setTableSaveStatus] = useState(null); // 'saving', 'saved', 'error'
    const [ideasContent, setIdeasContent] = useState('');
    const [ideasEditing, setIdeasEditing] = useState(false);
    const [ideasSaving, setIdeasSaving] = useState(false);
    const [ideasLastEditor, setIdeasLastEditor] = useState(null);
    const saveTimeoutRef = useRef(null);
    const router = useRouter();

    // 防抖保存表格数据
    const saveTableData = useCallback(async (data) => {
        if (!data) return;

        setTableSaveStatus('saving');
        try {
            const res = await fetch(`/api/posts/${id}/table`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableData: data.tableData,
                    columnWidths: data.columnWidths,
                    rowHeights: data.rowHeights
                })
            });

            if (res.ok) {
                setTableSaveStatus('saved');
                setTimeout(() => setTableSaveStatus(null), 2000);
            } else {
                setTableSaveStatus('error');
            }
        } catch (error) {
            console.error('Failed to save table:', error);
            setTableSaveStatus('error');
        }
    }, [id]);

    const handleTableChange = useCallback((data) => {
        // 清除之前的定时器
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        // 1秒后自动保存
        saveTimeoutRef.current = setTimeout(() => {
            saveTableData(data);
        }, 1000);
    }, [saveTableData]);

    useEffect(() => {
        fetchUser();
        fetchPost();
        fetchComments();
        fetchResults();
        fetchIdeas();
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

    const fetchIdeas = async () => {
        try {
            const res = await fetch(`/api/posts/${id}/ideas`);
            const data = await res.json();
            if (res.ok) {
                setIdeasContent(data.content || '');
                setIdeasLastEditor(data.lastEditorName);
            }
        } catch (error) {
            console.error('Failed to fetch ideas:', error);
        }
    };

    const handleIdeasSave = async () => {
        setIdeasSaving(true);
        try {
            const res = await fetch(`/api/posts/${id}/ideas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: ideasContent })
            });
            const data = await res.json();
            if (res.ok) {
                setIdeasLastEditor(data.lastEditorName);
                setIdeasEditing(false);
            } else {
                alert(data.error || '保存失败');
            }
        } catch (error) {
            console.error('Failed to save ideas:', error);
            alert('保存失败，请重试');
        } finally {
            setIdeasSaving(false);
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
                            {post.is_pinned ? (
                                <span style={{
                                    marginLeft: '12px',
                                    padding: '2px 8px',
                                    background: 'var(--warning)',
                                    color: '#000',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                }}>📌 置顶</span>
                            ) : null}
                        </h1>
                        {user && user.id === post.author_id && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="btn btn-sm"
                                    style={{
                                        background: post.is_pinned ? 'var(--warning)' : 'var(--bg-tertiary)',
                                        color: post.is_pinned ? '#000' : 'var(--text-primary)'
                                    }}
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(`/api/posts/${id}/pin`, { method: 'POST' });
                                            if (res.ok) {
                                                fetchPost(); // 刷新帖子数据
                                            } else {
                                                const data = await res.json();
                                                alert(data.error || '操作失败');
                                            }
                                        } catch (error) {
                                            alert('操作失败，请重试');
                                        }
                                    }}
                                >
                                    {post.is_pinned ? '📌 取消置顶' : '📌 置顶帖子'}
                                </button>
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

                {/* 正文内容 - 使用 InteractiveContent 支持逐行评论和高亮 */}
                {post.content && (
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <InteractiveContent
                            content={post.content}
                            postId={id}
                            user={user}
                        />
                    </div>
                )}

                {/* 主体布局：预览区 + 讨论区 */}
                <div className="post-detail">
                    <div className="post-main">
                        {/* 表格或链接预览区 */}
                        {post.post_type === 'table' ? (
                            /* 表格帖子显示 - 登录用户可编辑 */
                            <div className="preview-section">
                                <div className="preview-header">
                                    <h3 className="preview-title">📊 表格内容</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {tableSaveStatus === 'saving' && (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                ⏳ 保存中...
                                            </span>
                                        )}
                                        {tableSaveStatus === 'saved' && (
                                            <span style={{ color: 'var(--success)', fontSize: '13px' }}>
                                                ✓ 已保存
                                            </span>
                                        )}
                                        {tableSaveStatus === 'error' && (
                                            <span style={{ color: 'var(--error)', fontSize: '13px' }}>
                                                ✗ 保存失败
                                            </span>
                                        )}
                                        {user ? (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                点击单元格编辑，更改自动保存
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                登录后可编辑
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ padding: 'var(--spacing-md)' }}>
                                    <TableEditor
                                        initialData={post.tableData || [['']]}
                                        initialColumnWidths={post.columnWidths || []}
                                        initialRowHeights={post.rowHeights || []}
                                        onChange={user ? handleTableChange : undefined}
                                        readOnly={!user}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* 链接帖子显示 */
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
                        )}

                        {/* 很有意思的想法区 - 仅链接帖子显示 */}
                        {post.post_type !== 'table' && (
                            <div className="ideas-section" style={{
                                background: 'var(--bg-card)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--spacing-lg)',
                                marginBottom: 'var(--spacing-lg)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>💡 很有意思的想法区</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {ideasSaving && (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>保存中...</span>
                                        )}
                                        {ideasLastEditor && !ideasEditing && (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                上次编辑: {ideasLastEditor}
                                            </span>
                                        )}
                                        {user && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setIdeasEditing(!ideasEditing)}
                                            >
                                                {ideasEditing ? '取消' : '✏️ 编辑'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {ideasEditing ? (
                                    <div>
                                        <MarkdownEditor
                                            value={ideasContent}
                                            onChange={setIdeasContent}
                                            placeholder="分享你觉得有意思的想法，任何人都可以编辑这里..."
                                            minHeight={200}
                                        />
                                        <button
                                            className="btn btn-primary"
                                            style={{ marginTop: '12px' }}
                                            onClick={handleIdeasSave}
                                            disabled={ideasSaving}
                                        >
                                            保存想法
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                        {ideasContent ? (
                                            <MarkdownRenderer content={ideasContent} />
                                        ) : (
                                            <div className="empty-state" style={{ padding: '32px' }}>
                                                <p>暂无内容，{user ? '点击编辑添加想法' : '登录后可以编辑'}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

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

                        {/* 评分区 - 仅链接帖子显示 */}
                        {post.post_type !== 'table' && (
                            <RatingPanel
                                postId={id}
                                averages={ratings}
                                userRating={userRating}
                                onUpdate={(newRatings) => setRatings(newRatings)}
                            />
                        )}
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
                </div >
            </main >
        </>
    );
}
