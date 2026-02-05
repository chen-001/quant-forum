'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarkdownEditor } from '@/components/MarkdownRenderer';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import Link from 'next/link';

// 子页面链接插入对话框
function InsertChildPageModal({ isOpen, onClose, zoneId, currentPage, onInsert, pages, onRefresh }) {
    const [mode, setMode] = useState('create'); // 'create' or 'select'
    const [title, setTitle] = useState('');
    const [selectedPage, setSelectedPage] = useState(null);
    const [creating, setCreating] = useState(false);

    if (!isOpen) return null;

    // 获取当前页面的直接子页面
    const getChildPages = () => {
        if (!currentPage || !pages) return [];
        
        const findPageInTree = (pageList, pageId) => {
            for (const page of pageList) {
                if (page.id === pageId) return page;
                if (page.children?.length > 0) {
                    const found = findPageInTree(page.children, pageId);
                    if (found) return found;
                }
            }
            return null;
        };
        
        const pageInTree = findPageInTree(pages, currentPage.id);
        return pageInTree?.children || [];
    };

    const childPages = getChildPages();

    const handleCreateAndInsert = async () => {
        if (!title.trim()) return;
        
        setCreating(true);
        try {
            const res = await fetch(`/api/zones/${zoneId}/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    parentId: currentPage.id
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                // 生成子页面链接
                const childPath = data.path;
                const linkText = `[${title.trim()}](/zones/${zoneId}/${childPath})`;
                onInsert(linkText);
                setTitle('');
                onClose();
                // 刷新页面树
                if (onRefresh) onRefresh();
            } else {
                alert(data.error || '创建失败');
            }
        } catch (error) {
            console.error('Failed to create child page:', error);
            alert('创建失败');
        } finally {
            setCreating(false);
        }
    };

    const handleSelectInsert = () => {
        if (!selectedPage) return;
        const linkText = `[${selectedPage.title}](/zones/${zoneId}/${selectedPage.path})`;
        onInsert(linkText);
        setSelectedPage(null);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>插入子页面链接</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="insert-mode-tabs">
                        <button 
                            className={`mode-tab ${mode === 'create' ? 'active' : ''}`}
                            onClick={() => setMode('create')}
                        >
                            创建新子页面
                        </button>
                        {childPages.length > 0 && (
                            <button 
                                className={`mode-tab ${mode === 'select' ? 'active' : ''}`}
                                onClick={() => setMode('select')}
                            >
                                选择已有子页面
                            </button>
                        )}
                    </div>

                    {mode === 'create' ? (
                        <div className="insert-form">
                            <p className="insert-hint">
                                将创建一个新子页面，并在当前位置插入链接
                            </p>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="输入子页面标题"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateAndInsert();
                                    if (e.key === 'Escape') onClose();
                                }}
                            />
                            <div className="insert-preview">
                                {title.trim() && (
                                    <span>将插入: <code>[{title.trim()}](/zones/{zoneId}/{currentPage?.path}/{title.trim()})</code></span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="insert-form">
                            <p className="insert-hint">
                                选择一个已有的子页面插入链接
                            </p>
                            <div className="child-page-list">
                                {childPages.map(page => (
                                    <div
                                        key={page.id}
                                        className={`child-page-item ${selectedPage?.id === page.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedPage(page)}
                                    >
                                        <span className="page-icon">📄</span>
                                        <span className="page-title">{page.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>取消</button>
                    {mode === 'create' ? (
                        <button 
                            className="btn btn-primary" 
                            onClick={handleCreateAndInsert}
                            disabled={!title.trim() || creating}
                        >
                            {creating ? '创建中...' : '创建并插入'}
                        </button>
                    ) : (
                        <button 
                            className="btn btn-primary" 
                            onClick={handleSelectInsert}
                            disabled={!selectedPage}
                        >
                            插入链接
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ZonePageContent({ page, user, onUpdate, zoneId, pages }) {
    const [content, setContent] = useState(page?.content || '');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastEditor, setLastEditor] = useState(null);
    const [showInsertModal, setShowInsertModal] = useState(false);

    // 当页面变化时更新内容
    useEffect(() => {
        if (page) {
            setContent(page.content || '');
            setIsEditing(false);
        }
    }, [page?.id]);

    const handleSave = useCallback(async () => {
        if (!user || !page) return;
        
        setSaving(true);
        try {
            const res = await fetch(`/api/zones/pages/${page.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            
            if (res.ok) {
                setIsEditing(false);
                if (user) {
                    setLastEditor(user.username);
                }
                if (onUpdate) {
                    onUpdate();
                }
            } else {
                const data = await res.json();
                alert(data.error || '保存失败');
            }
        } catch (error) {
            console.error('Failed to save page:', error);
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    }, [content, page, user, onUpdate]);

    const handleExport = () => {
        if (!page) return;
        
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${page.title}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 在光标位置插入文本
    const insertAtCursor = (text) => {
        const textarea = document.querySelector('.zone-page-editor textarea');
        if (!textarea) {
            // 如果没有找到textarea，直接追加到内容末尾
            setContent(prev => prev + '\n' + text);
            return;
        }
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = content.substring(0, start);
        const after = content.substring(end);
        
        // 如果光标前没有换行，添加换行
        const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
        // 如果光标后没有换行，添加换行
        const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
        
        const newContent = before + prefix + text + suffix + after;
        setContent(newContent);
        
        // 设置新的光标位置
        setTimeout(() => {
            const newCursorPos = start + prefix.length + text.length + suffix.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }, 0);
    };

    if (!page) {
        return (
            <div className="zone-page-content-empty">
                <p>请选择一个页面查看内容</p>
            </div>
        );
    }

    return (
        <div className="zone-page-content">
            <div className="zone-page-content-header">
                <h1>{page.title}</h1>
                <div className="zone-page-content-meta">
                    <span>创建者: {page.created_by_name}</span>
                    <span>更新于: {new Date(page.updated_at + 'Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
                    {lastEditor && <span>最后编辑: {lastEditor}</span>}
                </div>
                <div className="zone-page-content-actions">
                    {user && (
                        <>
                            {isEditing ? (
                                <>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? '保存中...' : '保存'}
                                    </button>
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setContent(page.content || '');
                                        }}
                                    >
                                        取消
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setIsEditing(true)}
                                >
                                    ✏️ 编辑
                                </button>
                            )}
                        </>
                    )}
                    <button
                        className="btn btn-ghost"
                        onClick={handleExport}
                        title="导出为 Markdown"
                    >
                        📥 导出
                    </button>
                </div>
            </div>

            <div className="zone-page-content-body">
                {isEditing ? (
                    <div className="zone-page-editor">
                        <div className="editor-toolbar">
                            <button
                                className="toolbar-btn"
                                onClick={() => setShowInsertModal(true)}
                                title="插入子页面链接"
                            >
                                📄 插入子页面
                            </button>
                        </div>
                        <MarkdownEditor
                            value={content}
                            onChange={setContent}
                            placeholder="开始编写内容..."
                            minHeight={400}
                        />
                    </div>
                ) : (
                    <div className="zone-page-preview">
                        {content ? (
                            <MarkdownRenderer content={content} />
                        ) : (
                            <div className="zone-page-content-placeholder">
                                <p>该页面暂无内容</p>
                                {user && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        开始编辑
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <InsertChildPageModal
                isOpen={showInsertModal}
                onClose={() => setShowInsertModal(false)}
                zoneId={zoneId}
                currentPage={page}
                pages={pages}
                onInsert={insertAtCursor}
                onRefresh={onUpdate}
            />
        </div>
    );
}
