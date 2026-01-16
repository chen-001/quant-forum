'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { MarkdownEditor } from '@/components/MarkdownRenderer';
import UserTransferModal from '@/components/UserTransferModal';
import Link from 'next/link';

export default function TodosPage() {
    const [user, setUser] = useState(null);
    const [todos, setTodos] = useState([]);
    const [filter, setFilter] = useState('incomplete');
    const [scope, setScope] = useState('mine');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingNote, setEditingNote] = useState(null);
    const [noteContent, setNoteContent] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedTodoId, setSelectedTodoId] = useState(null);

    useEffect(() => {
        fetchUser();
        fetchTodos();
    }, [filter, scope]);

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            setUser(data.user);
        } catch (error) {
            console.error('Failed to fetch user:', error);
        }
    };

    // 当 scope 变为 'mine' 时，重置选中的用户
    useEffect(() => {
        if (scope === 'mine') {
            setSelectedUserId(null);
        }
    }, [scope]);

    const fetchTodos = async () => {
        try {
            let url = '/api/todos';
            const params = new URLSearchParams();

            if (filter === 'completed') {
                params.append('isCompleted', 'true');
            } else if (filter === 'incomplete') {
                params.append('isCompleted', 'false');
            }

            params.append('scope', scope);

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const res = await fetch(url);
            const data = await res.json();

            if (res.ok) {
                setTodos(data.todos || []);
                // 默认选中第一个用户（在"大家的"模式下）
                if (scope === 'all' && data.todos && data.todos.length > 0 && !selectedUserId) {
                    setSelectedUserId(data.todos[0].todo_author_id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch todos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleComplete = async (id, currentStatus) => {
        try {
            const res = await fetch(`/api/todos/${id}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: !currentStatus })
            });

            if (res.ok) {
                setTodos(todos.map(t =>
                    t.id === id
                        ? { ...t, is_completed: !currentStatus ? 1 : 0, completed_at: !currentStatus ? new Date().toISOString() : null }
                        : t
                ));
            }
        } catch (error) {
            console.error('Failed to update todo:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('确定要删除这个待办吗？')) return;

        try {
            const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });

            if (res.ok) {
                setTodos(todos.filter(t => t.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete todo:', error);
        }
    };

    const handleToggleVisibility = async (id, currentVisibility) => {
        const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
        try {
            const res = await fetch(`/api/todos/${id}/visibility`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visibility: newVisibility })
            });

            if (res.ok) {
                setTodos(todos.map(t =>
                    t.id === id ? { ...t, visibility: newVisibility } : t
                ));
            }
        } catch (error) {
            console.error('Failed to update visibility:', error);
        }
    };

    const handleSaveNote = async (id) => {
        setSavingNote(true);
        try {
            const res = await fetch(`/api/todos/${id}/note`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: noteContent })
            });

            if (res.ok) {
                setTodos(todos.map(t =>
                    t.id === id ? { ...t, note: noteContent } : t
                ));
                setEditingNote(null);
                setNoteContent('');
            }
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setSavingNote(false);
        }
    };

    const handleTransfer = async (todoId, targetUserId) => {
        try {
            const res = await fetch(`/api/todos/${todoId}/transfer`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId })
            });

            if (res.ok) {
                // 从列表中移除该待办（因为已经不属于当前用户）
                setTodos(todos.filter(t => t.id !== todoId));
            } else {
                const data = await res.json();
                alert(data.error || '流转失败');
            }
        } catch (error) {
            console.error('Failed to transfer todo:', error);
            alert('流转失败');
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

    const renderContent = (todo) => {
        switch (todo.content_type) {
            case 'post':
                return (
                    <div>
                        <Link href={`/post/${todo.post_id}`} className="todo-post-title">
                            <h3>{todo.post_title}</h3>
                        </Link>
                        <div className="todo-meta">
                            <span>👤 {todo.post_author_name}</span>
                            <span>📅 {formatDate(todo.created_at)}</span>
                        </div>
                    </div>
                );

            case 'comment':
                return (
                    <div>
                        <Link href={`/post/${todo.post_id}`} className="todo-post-title">
                            <h4>{todo.post_title}</h4>
                        </Link>
                        <div className="todo-comment">
                            <MarkdownRenderer content={todo.comment_content} />
                        </div>
                        <div className="todo-meta">
                            <span>💬 {todo.comment_author_name}</span>
                            <span>📅 {formatDate(todo.created_at)}</span>
                        </div>
                    </div>
                );

            case 'result':
                return (
                    <div>
                        <Link href={`/post/${todo.post_id}`} className="todo-post-title">
                            <h4>{todo.post_title}</h4>
                        </Link>
                        <div className="todo-result">
                            <MarkdownRenderer content={todo.result_content} />
                        </div>
                        <div className="todo-meta">
                            <span>🏆 {todo.result_author_name}</span>
                            <span>📅 {formatDate(todo.created_at)}</span>
                        </div>
                    </div>
                );

            case 'text_selection':
                return (
                    <div>
                        <Link href={`/post/${todo.post_id}`} className="todo-post-title">
                            <h4>{todo.post_title}</h4>
                        </Link>
                        <div className="todo-text-selection">
                            <p>"{todo.text_data}"</p>
                            {todo.line_index !== null && (
                                <span className="line-info">第 {todo.line_index + 1} 行</span>
                            )}
                        </div>
                        <div className="todo-meta">
                            <span>📅 {formatDate(todo.created_at)}</span>
                        </div>
                    </div>
                );

            case 'image':
                return (
                    <div>
                        <Link href={`/post/${todo.post_id}`} className="todo-post-title">
                            <h4>{todo.post_title}</h4>
                        </Link>
                        <div className="todo-image">
                            <img src={todo.image_url} alt="待办图片" />
                        </div>
                        <div className="todo-meta">
                            <span>📅 {formatDate(todo.created_at)}</span>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    // 获取唯一的用户列表（用于"大家的"模式）
    const getUniqueUsers = () => {
        const userMap = new Map();
        todos.forEach(todo => {
            if (todo.todo_author_id && todo.todo_author_name) {
                userMap.set(todo.todo_author_id, todo.todo_author_name);
            }
        });
        return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
    };

    // 根据选中的用户过滤待办
    const getFilteredTodos = () => {
        if (scope === 'mine' || !selectedUserId) {
            return todos;
        }
        return todos.filter(todo => todo.todo_author_id === selectedUserId);
    };

    const uniqueUsers = getUniqueUsers();
    const displayedTodos = getFilteredTodos();

    return (
        <>
            <Header />
            <main className="container">
                <div className="todos-page">
                    <div className="todos-header">
                        <h1>📋 我的待办</h1>
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
                        <div className="todos-filter">
                            <button
                                className={filter === 'incomplete' ? 'active' : ''}
                                onClick={() => setFilter('incomplete')}
                            >
                                未完成
                            </button>
                            <button
                                className={filter === 'completed' ? 'active' : ''}
                                onClick={() => setFilter('completed')}
                            >
                                已完成
                            </button>
                            <button
                                className={filter === 'all' ? 'active' : ''}
                                onClick={() => setFilter('all')}
                            >
                                全部
                            </button>
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
                    ) : displayedTodos.length === 0 ? (
                        <div className="empty-state">
                            <p>还没有待办，右键点击内容可以添加到待办</p>
                        </div>
                    ) : (
                        <div className="todos-list">
                            {displayedTodos.map(todo => (
                                <div key={todo.id} className={`todo-item ${todo.is_completed ? 'completed' : ''}`}>
                                    <div className="todo-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={todo.is_completed === 1}
                                            onChange={() => handleToggleComplete(todo.id, todo.is_completed === 1)}
                                        />
                                    </div>
                                    <div className="todo-content">
                                        {renderContent(todo)}

                                        {editingNote === todo.id ? (
                                            <div className="todo-note-edit">
                                                <MarkdownEditor
                                                    value={noteContent}
                                                    onChange={setNoteContent}
                                                    placeholder="添加说明..."
                                                    minHeight={100}
                                                />
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleSaveNote(todo.id)}
                                                        disabled={savingNote}
                                                    >
                                                        保存
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => {
                                                            setEditingNote(null);
                                                            setNoteContent('');
                                                        }}
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="todo-note">
                                                {todo.note && (
                                                    <div className="note-content">
                                                        <MarkdownRenderer content={todo.note} />
                                                    </div>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => {
                                                        setEditingNote(todo.id);
                                                        setNoteContent(todo.note || '');
                                                    }}
                                                >
                                                    {todo.note ? '✏️ 编辑说明' : '+ 添加说明'}
                                                </button>
                                            </div>
                                        )}

                                        {todo.is_completed === 1 && todo.completed_at && (
                                            <div className="todo-completed-info">
                                                完成于 {formatDate(todo.completed_at)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="todo-actions">
                                        {scope === 'mine' && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    setSelectedTodoId(todo.id);
                                                    setShowTransferModal(true);
                                                }}
                                                title="流转给其他用户"
                                            >
                                                🔄 流转
                                            </button>
                                        )}
                                        {scope === 'mine' && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleToggleVisibility(todo.id, todo.visibility || 'public')}
                                                title={(todo.visibility || 'public') === 'public' ? '设为仅自己可见' : '设为所有人可见'}
                                            >
                                                {(todo.visibility || 'public') === 'public' ? '🌐 公开' : '🔒 私密'}
                                            </button>
                                        )}
                                        <button
                                            className={`btn btn-sm ${todo.is_completed === 1 ? 'btn-success' : 'btn-ghost'}`}
                                            onClick={() => handleToggleComplete(todo.id, todo.is_completed === 1)}
                                            title={todo.is_completed === 1 ? '标记为未完成' : '标记为完成'}
                                        >
                                            {todo.is_completed === 1 ? '✓ 已完成' : '○ 标记完成'}
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDelete(todo.id)}
                                            title="删除待办"
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
            <UserTransferModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                onTransfer={(targetUserId) => handleTransfer(selectedTodoId, targetUserId)}
                currentUserId={user?.id}
            />
        </>
    );
}
