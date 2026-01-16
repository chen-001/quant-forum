'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MarkdownRenderer, { MarkdownEditor } from '@/components/MarkdownRenderer';
import RatingPanel from '@/components/RatingPanel';
import TableEditor from '@/components/TableEditor';
import InteractiveContent from '@/components/InteractiveContent';
import InteractiveMarkdownRenderer from '@/components/InteractiveMarkdownRenderer';
import FavoriteTodoIndicator from '@/components/FavoriteTodoIndicator';

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
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editCommentContent, setEditCommentContent] = useState('');
    const [commentFilter, setCommentFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('free');
    const [editingCategoryCommentId, setEditingCategoryCommentId] = useState(null);
    const [isElectron, setIsElectron] = useState(false);
    const [showAddLinkForm, setShowAddLinkForm] = useState(false);
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [addingLink, setAddingLink] = useState(false);
    const saveTimeoutRef = useRef(null);
    const router = useRouter();

    // 检测 Electron 环境
    useEffect(() => {
        if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
            setIsElectron(true);
        }
    }, []);

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
                    parentId: replyTo?.id || null,
                    category: selectedCategory
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

    const handleCommentEdit = async (commentId) => {
        if (!editCommentContent.trim()) return;

        try {
            const res = await fetch(`/api/posts/${id}/comments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId,
                    content: editCommentContent
                })
            });

            if (res.ok) {
                setEditingCommentId(null);
                setEditCommentContent('');
                fetchComments();
            } else {
                const data = await res.json();
                alert(data.error || '编辑失败');
            }
        } catch (error) {
            console.error('Failed to edit comment:', error);
            alert('编辑失败，请重试');
        }
    };

    const handleCommentDelete = async (commentId) => {
        if (!confirm('确定要删除这条评论吗？')) return;

        try {
            const res = await fetch(`/api/posts/${id}/comments?commentId=${commentId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchComments();
            } else {
                const data = await res.json();
                alert(data.error || '删除失败');
            }
        } catch (error) {
            console.error('Failed to delete comment:', error);
            alert('删除失败，请重试');
        }
    };

    const handleCategoryChange = async (commentId, newCategory) => {
        try {
            const res = await fetch(`/api/posts/${id}/comments`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId, category: newCategory })
            });
            if (res.ok) {
                setEditingCategoryCommentId(null);
                fetchComments();
            } else {
                const data = await res.json();
                alert(data.error || '修改标签失败');
            }
        } catch (error) {
            console.error('Failed to change category:', error);
            alert('修改标签失败，请重试');
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

    // Filter comments recursively
    const filterComments = (tree, filter) => {
        if (!filter.trim()) return tree;
        const lowerFilter = filter.toLowerCase();

        const matches = (comment) => {
            return comment.author_name.toLowerCase().includes(lowerFilter) ||
                comment.content.toLowerCase().includes(lowerFilter);
        };

        const filterRecursive = (comments) => {
            return comments
                .map(c => ({
                    ...c,
                    replies: filterRecursive(c.replies || [])
                }))
                .filter(c => matches(c) || c.replies.length > 0);
        };

        return filterRecursive(tree);
    };

    // Filter comments by category
    const filterCommentsByCategory = (tree, category) => {
        if (!category) return tree;
        
        const filterRecursive = (comments) => {
            return comments
                .filter(c => c.category === category)
                .map(c => ({
                    ...c,
                    replies: filterRecursive(c.replies || [])
                }));
        };

        return filterRecursive(tree);
    };

    const filteredCommentTree = filterCommentsByCategory(filterComments(commentTree, commentFilter), selectedCategory);

    const renderComment = (comment, depth = 0) => (
        <div key={comment.id} className={`comment-item ${depth > 0 ? 'reply' : ''}`}>
            <div className="comment-header">
                <span className="comment-author">{comment.author_name}</span>
                <span className="comment-time">{formatDate(comment.created_at)}</span>
            </div>
            {editingCommentId === comment.id ? (
                <div style={{ marginBottom: '8px' }}>
                    <MarkdownEditor
                        value={editCommentContent}
                        onChange={setEditCommentContent}
                        placeholder="编辑评论..."
                        minHeight={80}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCommentEdit(comment.id)}
                            disabled={!editCommentContent.trim()}
                        >
                            保存
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                setEditingCommentId(null);
                                setEditCommentContent('');
                            }}
                        >
                            取消
                        </button>
                    </div>
                </div>
            ) : (
                <div className="comment-content">
                    <InteractiveMarkdownRenderer
                        contentType="comment"
                        postId={id}
                        commentId={comment.id.toString()}
                        content={comment.content}
                        user={user}
                    />
                </div>
            )}
            <div className="comment-actions">
                <button
                    className={`comment-action ${userReactions.some(r => r.comment_id === comment.id && r.reaction_type === 'like') ? 'active' : ''}`}
                    onClick={() => user && handleReaction(comment.id, 'like')}
                    data-count={comment.likes_count}
                >
                    <span className="emoji">👍</span>
                    <span className="label desktop-only">点赞</span>
                </button>
                <button
                    className={`comment-action ${userReactions.some(r => r.comment_id === comment.id && r.reaction_type === 'doubt') ? 'active' : ''}`}
                    onClick={() => user && handleReaction(comment.id, 'doubt')}
                    data-count={comment.doubts_count}
                >
                    <span className="emoji">🤔</span>
                    <span className="label desktop-only">质疑</span>
                </button>
                {user && (
                    <button
                        className="comment-action"
                        onClick={() => setReplyTo(comment)}
                    >
                        <span className="emoji">💬</span>
                        <span className="label desktop-only">回复</span>
                    </button>
                )}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        className={`comment-action ${editingCategoryCommentId === comment.id ? 'active' : ''}`}
                        onClick={() => {
                            if (user && user.id === comment.author_id) {
                                setEditingCategoryCommentId(editingCategoryCommentId === comment.id ? null : comment.id);
                            }
                        }}
                        title={user && user.id === comment.author_id ? '修改标签' : `标签: ${comment.category === 'free' ? '自由' : comment.category}`}
                    >
                        <span className="emoji">🏷️</span>
                        <span className="label desktop-only">{comment.category === 'free' ? '自由' : comment.category}</span>
                    </button>
                    {editingCategoryCommentId === comment.id && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '0',
                            marginBottom: '8px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px',
                            minWidth: '120px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 10
                        }}>
                            <div style={{ marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>选择标签:</div>
                            {post.links?.map((link) => (
                                <button
                                    key={link.id}
                                    className={`btn btn-sm ${comment.category === link.title ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ width: '100%', marginBottom: '4px', justifyContent: 'flex-start' }}
                                    onClick={() => handleCategoryChange(comment.id, link.title)}
                                >
                                    {link.title}
                                </button>
                            ))}
                            <button
                                className={`btn btn-sm ${comment.category === 'free' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ width: '100%', marginBottom: '4px', justifyContent: 'flex-start' }}
                                onClick={() => handleCategoryChange(comment.id, 'free')}
                            >
                                自由
                            </button>
                        </div>
                    )}
                </div>
                {user && user.id === comment.author_id && editingCommentId !== comment.id && (
                    <>
                        <button
                            className="comment-action"
                            onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditCommentContent(comment.content);
                            }}
                        >
                            <span className="emoji">✏️</span>
                            <span className="label desktop-only">编辑</span>
                        </button>
                        <button
                            className="comment-action"
                            style={{ color: 'var(--error)' }}
                            onClick={() => handleCommentDelete(comment.id)}
                        >
                            <span className="emoji">🗑️</span>
                            <span className="label desktop-only">删除</span>
                        </button>
                    </>
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
                <div className="post-detail-header" style={{ marginBottom: '0' }}>
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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <FavoriteTodoIndicator
                                contentType="post"
                                postId={id}
                                onToggleFavorite={async () => {
                                    try {
                                        const res = await fetch('/api/favorites', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ contentType: 'post', postId: id })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            alert(data.message);
                                        } else {
                                            alert(data.error || '操作失败');
                                        }
                                    } catch (error) {
                                        alert('操作失败');
                                    }
                                }}
                                onToggleTodo={async () => {
                                    try {
                                        const res = await fetch('/api/todos', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ contentType: 'post', postId: id })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            alert(data.message);
                                        } else {
                                            alert(data.error || '操作失败');
                                        }
                                    } catch (error) {
                                        alert('操作失败');
                                    }
                                }}
                            />
                            {user && user.id === post.author_id && (
                                <>
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
                                </>
                            )}
                        </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        👤 {post.author_name} · 📅 {formatDate(post.created_at)}
                    </div>
                </div>

                {/* 主体布局：预览区 + 讨论区 */}
                <div className="post-detail">
                    {/* 预览区容器：包含正文和AI链接 */}
                    <div className="preview-section">
                        {/* 正文内容 - 使用 InteractiveContent 支持逐行评论和高亮 */}
                        {post.content && (
                            <div style={{ paddingBottom: '1vh' }}>
                                <InteractiveContent
                                    content={post.content}
                                    postId={id}
                                    user={user}
                                />
                            </div>
                        )}

                        {/* 表格或链接预览区 */}
                        {post.post_type === 'table' ? (
                            /* 表格帖子显示 - 登录用户可编辑 */
                            <>
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
                            </>
                        ) : (
                            /* 链接帖子显示 */
                            <>
                                <div className="preview-header">
                                    <h3 className="preview-title">🔗 AI对话链接</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                            点击链接展开预览（最多{MAX_OPEN_FRAMES}个）
                                        </span>
                                        {user && (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => setShowAddLinkForm(!showAddLinkForm)}
                                            >
                                                {showAddLinkForm ? '取消' : '+ 添加链接'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                            {/* 添加链接表单 */}
                            {showAddLinkForm && (
                                <div style={{
                                    padding: '16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            链接名称 {user && post.author_id !== user.id && <span style={{ color: 'var(--text-muted)' }}>(将自动添加您的用户名后缀)</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={newLinkTitle}
                                            onChange={(e) => setNewLinkTitle(e.target.value)}
                                            placeholder="例如：gemini, claude, chatgpt..."
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            链接URL
                                        </label>
                                        <input
                                            type="url"
                                            value={newLinkUrl}
                                            onChange={(e) => setNewLinkUrl(e.target.value)}
                                            placeholder="https://..."
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-primary)',
                                                color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        disabled={!newLinkUrl.trim() || addingLink}
                                        onClick={async () => {
                                            setAddingLink(true);
                                            try {
                                                const res = await fetch(`/api/posts/${id}/links`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        url: newLinkUrl,
                                                        title: newLinkTitle
                                                    })
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    setPost(prev => ({ ...prev, links: data.links }));
                                                    setNewLinkTitle('');
                                                    setNewLinkUrl('');
                                                    setShowAddLinkForm(false);
                                                } else {
                                                    alert(data.error || '添加链接失败');
                                                }
                                            } catch (error) {
                                                console.error('Failed to add link:', error);
                                                alert('添加链接失败，请重试');
                                            } finally {
                                                setAddingLink(false);
                                            }
                                        }}
                                    >
                                        {addingLink ? '添加中...' : '添加链接'}
                                    </button>
                                </div>
                            )}

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
                                    {openLinks.map((link) => {
                                        const useProxy = link.useProxy || false;
                                        const iframeSrc = useProxy
                                            ? `/api/proxy?url=${encodeURIComponent(link.url)}`
                                            : link.url;
                                        return (
                                            <div key={link.id} className="preview-frame">
                                                <div className="preview-frame-header">
                                                    <span className="preview-frame-url" title={link.url}>
                                                        {link.title || link.url}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        {isElectron && (
                                                            <span style={{
                                                                fontSize: '12px',
                                                                color: 'var(--success)',
                                                                background: 'rgba(16, 185, 129, 0.1)',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                🖥️ 桌面模式
                                                            </span>
                                                        )}
                                                        {!isElectron && (
                                                            <button
                                                                className={`btn btn-sm ${useProxy ? 'btn-primary' : 'btn-ghost'}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenLinks(prev => prev.map(l =>
                                                                        l.id === link.id
                                                                            ? { ...l, useProxy: !l.useProxy }
                                                                            : l
                                                                    ));
                                                                }}
                                                                title={useProxy ? '当前使用代理模式' : '点击切换到代理模式'}
                                                            >
                                                                {useProxy ? '🔄 代理模式' : '⚡ 直连模式'}
                                                            </button>
                                                        )}
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
                                                </div>
                                                {isElectron ? (
                                                    /* Electron 环境使用 webview，可加载任何网页 */
                                                    <webview
                                                        src={link.url}
                                                        className="preview-iframe"
                                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                                    />
                                                ) : (
                                                    /* 浏览器环境使用 iframe */
                                                    <iframe
                                                        key={`${link.id}-${useProxy}`}
                                                        src={iframeSrc}
                                                        className="preview-iframe"
                                                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                )}
                                                {!isElectron && (
                                                    <div className="preview-blocked" style={{ display: 'none' }}>
                                                        <p>⚠️ 该网站禁止嵌入显示</p>
                                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                                            使用桌面客户端可打开任何网页
                                                        </p>
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
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: '48px' }}>
                                    <p>👆 点击上方链接以展开预览</p>
                                </div>
                            )}
                            </>
                        )}
                    </div>

                    {/* 很有意思的想法区 - 仅链接帖子显示 */}
                    {post.post_type !== 'table' && (
                        <div className="ideas-section" style={{
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--spacing-lg)'
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
                                        <InteractiveMarkdownRenderer
                                            contentType="idea"
                                            postId={id}
                                            content={ideasContent}
                                            user={user}
                                        />
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
                                        <InteractiveMarkdownRenderer
                                            contentType="result"
                                            postId={id}
                                            resultId={result.id.toString()}
                                            content={result.content}
                                            user={user}
                                        />
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

                    {/* 想法讨论区（侧边栏） */}
                    <div className="post-sidebar">
                        <div className="discussion-section">
                            {/* 左侧控制面板 */}
                            <div className="discussion-sidebar">
                                <div className="discussion-header">
                                    💬 想法讨论区 ({comments.length})
                                </div>

                                {/* 子板块Tab导航 */}
                                {post.post_type !== 'table' && post.links && post.links.length > 0 && (
                                    <div className="discussion-tabs">
                                        {post.links.map((link) => {
                                            const categoryCommentCount = comments.filter(c => c.category === link.title).length;
                                            return (
                                                <button
                                                    key={link.id}
                                                    className={`discussion-tab ${selectedCategory === link.title ? 'active' : ''}`}
                                                    onClick={() => setSelectedCategory(link.title)}
                                                >
                                                    <span>{link.title}</span>
                                                    <span className="discussion-tab-count">({categoryCommentCount})</span>
                                                </button>
                                            );
                                        })}
                                        <button
                                            className={`discussion-tab ${selectedCategory === 'free' ? 'active' : ''}`}
                                            onClick={() => setSelectedCategory('free')}
                                        >
                                            <span>自由</span>
                                            <span className="discussion-tab-count">({comments.filter(c => c.category === 'free').length})</span>
                                        </button>
                                    </div>
                                )}

                                {/* 评论筛选 */}
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="🔍 搜索评论..."
                                        value={commentFilter}
                                        onChange={(e) => setCommentFilter(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 32px 8px 12px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '13px'
                                        }}
                                    />
                                    {commentFilter && (
                                        <button
                                            onClick={() => setCommentFilter('')}
                                            style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-muted)',
                                                fontSize: '14px'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {commentFilter && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        找到 {filteredCommentTree.length} 条匹配
                                    </div>
                                )}
                            </div>

                            {/* 右侧评论区域 */}
                            <div className="discussion-content">
                                <div className="comments-list">
                                    {filteredCommentTree.length === 0 ? (
                                        <div className="empty-state" style={{ padding: '24px' }}>
                                            <p>{commentFilter ? '没有找到匹配的评论' : '还没有评论，来发表第一条吧！'}</p>
                                        </div>
                                    ) : (
                                        filteredCommentTree.map(comment => renderComment(comment))
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
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <MarkdownEditor
                                                    value={newComment}
                                                    onChange={setNewComment}
                                                    placeholder={`在「${selectedCategory === 'free' ? '自由' : selectedCategory}」区写下你的想法，支持Markdown...（支持粘贴图片）`}
                                                    minHeight={80}
                                                />
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                style={{ marginTop: '0', whiteSpace: 'nowrap', height: '80px' }}
                                                onClick={handleCommentSubmit}
                                                disabled={!newComment.trim()}
                                            >
                                                发表
                                            </button>
                                        </div>
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
                </div >
            </main >
        </>
    );
}
