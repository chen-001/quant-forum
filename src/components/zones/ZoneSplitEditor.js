'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { MarkdownEditor } from '@/components/MarkdownRenderer';

// 子页面链接插入对话框
function InsertChildPageModal({ isOpen, onClose, zoneId, currentPage, onInsert, pages, onRefresh }) {
    const [mode, setMode] = useState('create');
    const [title, setTitle] = useState('');
    const [selectedPage, setSelectedPage] = useState(null);
    const [creating, setCreating] = useState(false);

    if (!isOpen) return null;

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
                const childPath = data.path;
                const linkText = `[${title.trim()}](/zones/${zoneId}/${childPath})`;
                onInsert(linkText);
                setTitle('');
                onClose();
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
                            <p className="insert-hint">将创建一个新子页面，并在当前位置插入链接</p>
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
                            <p className="insert-hint">选择一个已有的子页面插入链接</p>
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

export default function ZoneSplitEditor({ page, user, onUpdate, zoneId, pages }) {
    const [content, setContent] = useState(page?.content || '');
    const [saveStatus, setSaveStatus] = useState('saved');
    const [lastSaved, setLastSaved] = useState(new Date(page?.updated_at ? page.updated_at + 'Z' : Date.now()));
    const [showInsertModal, setShowInsertModal] = useState(false);
    const [splitRatio, setSplitRatio] = useState(50);
    const [isResizing, setIsResizing] = useState(false);
    const [showPreview, setShowPreview] = useState(true);
    const saveTimeoutRef = useRef(null);
    const containerRef = useRef(null);
    const textareaRef = useRef(null);

    // 页面变化时更新内容
    useEffect(() => {
        if (page) {
            setContent(page.content || '');
            setSaveStatus('saved');
            setLastSaved(new Date(page.updated_at ? page.updated_at + 'Z' : Date.now()));
        }
    }, [page?.id]);

    // 自动保存逻辑
    const doSave = useCallback(async (contentToSave) => {
        if (!user || !page) return;
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/zones/pages/${page.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: contentToSave })
            });
            if (res.ok) {
                setSaveStatus('saved');
                setLastSaved(new Date());
                if (onUpdate) {
                    onUpdate();
                }
            } else {
                const data = await res.json();
                console.error('Save failed:', data.error);
                setSaveStatus('unsaved');
            }
        } catch (error) {
            console.error('Failed to save page:', error);
            setSaveStatus('unsaved');
        }
    }, [page, user, onUpdate]);

    // 内容变化时触发防抖保存
    const handleContentChange = useCallback((newContent) => {
        setContent(newContent);
        setSaveStatus('unsaved');
        
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
            doSave(newContent);
        }, 2000);
    }, [doSave]);

    // 手动保存
    const handleManualSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        doSave(content);
    }, [content, doSave]);

    // 监听键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleManualSave();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleManualSave]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // 分栏拖动调整
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
            setSplitRatio(Math.max(20, Math.min(80, newRatio)));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

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

    const insertAtCursor = (text) => {
        const editor = textareaRef.current;
        if (!editor || !editor.textarea) {
            const newContent = content + '\n' + text;
            setContent(newContent);
            handleContentChange(newContent);
            return;
        }
        const textarea = editor.textarea;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const before = content.substring(0, start);
        const after = content.substring(end);
        const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
        const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
        const newContent = before + prefix + text + suffix + after;
        setContent(newContent);
        handleContentChange(newContent);
        setTimeout(() => {
            const newCursorPos = start + prefix.length + text.length + suffix.length;
            editor.setSelectionRange(newCursorPos, newCursorPos);
            editor.focus();
        }, 0);
    };

    // 防抖渲染预览 - 使用 useMemo 缓存渲染结果
    const previewContent = useMemo(() => content, [content]);

    const getSaveStatusDisplay = () => {
        switch (saveStatus) {
            case 'saving':
                return <span className="save-status saving">💾 保存中...</span>;
            case 'unsaved':
                return <span className="save-status unsaved">● 待保存</span>;
            case 'saved':
            default:
                return <span className="save-status saved">✓ 已保存 {lastSaved.toLocaleTimeString('zh-CN')}</span>;
        }
    };

    if (!page) {
        return (
            <div className="zone-split-editor-empty">
                <p>请选择一个页面查看内容</p>
            </div>
        );
    }

    return (
        <div className="zone-split-editor">
            {/* 头部信息栏 */}
            <div className="zone-split-editor-header">
                <div className="header-left">
                    <h1>{page.title}</h1>
                    <div className="zone-page-content-meta">
                        <span>创建者: {page.created_by_name}</span>
                        <span>更新于: {new Date(page.updated_at + 'Z').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
                    </div>
                </div>
                <div className="header-right">
                    {user && getSaveStatusDisplay()}
                    {user && (
                        <button
                            className={`btn ${showPreview ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => setShowPreview(!showPreview)}
                            title={showPreview ? '隐藏预览' : '显示预览'}
                        >
                            {showPreview ? '👁️ 隐藏预览' : '👁️ 显示预览'}
                        </button>
                    )}
                    {user && (
                        <button
                            className="btn btn-primary"
                            onClick={handleManualSave}
                            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                            title="Ctrl+S 保存"
                        >
                            {saveStatus === 'saving' ? '保存中...' : '保存'}
                        </button>
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

            {/* 编辑工具栏 */}
            {user && (
                <div className="zone-split-editor-toolbar">
                    <button
                        className="toolbar-btn"
                        onClick={() => setShowInsertModal(true)}
                        title="插入子页面链接"
                    >
                        📄 插入子页面
                    </button>
                    <label className="toolbar-btn" title="上传并插入文件">
                        📎 插入文件
                        <input
                            type="file"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                const formData = new FormData();
                                formData.append('file', file);
                                
                                try {
                                    const res = await fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData
                                    });
                                    
                                    if (res.ok) {
                                        const data = await res.json();
                                        const isImage = file.type.startsWith('image/');
                                        const markdown = isImage
                                            ? `![${file.name}](${data.url})`
                                            : `[${data.filename}](${data.url})`;
                                        insertAtCursor(markdown);
                                    } else {
                                        alert('上传失败');
                                    }
                                } catch (error) {
                                    console.error('Upload failed:', error);
                                    alert('上传失败');
                                }
                                e.target.value = '';
                            }}
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.py,.js"
                        />
                    </label>
                    <div className="toolbar-divider"></div>
                    <span className="toolbar-hint">
                        💡 按 Ctrl+S 快速保存，内容每 2 秒自动保存
                        {showPreview && ' | 左侧编辑，右侧实时预览'}
                    </span>
                </div>
            )}

            {/* 内容区域 */}
            <div 
                className={`zone-split-editor-body ${showPreview ? 'with-preview' : 'editor-only'}`}
                ref={containerRef}
            >
                {user ? (
                    showPreview ? (
                        // 左右分栏模式
                        <>
                            {/* 左侧：编辑器 */}
                            <div 
                                className="split-editor-panel"
                                style={{ width: `${splitRatio}%` }}
                            >
                                <div className="panel-label">✏️ 编辑</div>
                                <MarkdownEditor
                                    ref={textareaRef}
                                    value={content}
                                    onChange={handleContentChange}
                                    placeholder="开始编写内容...&#x0A;支持 Markdown 语法、LaTeX 公式 ($formula$)、代码块等"
                                    minHeight={500}
                                />
                            </div>

                            {/* 拖动条 */}
                            <div 
                                className="split-resize-handle"
                                onMouseDown={() => setIsResizing(true)}
                            />

                            {/* 右侧：实时预览 */}
                            <div 
                                className="split-preview-panel"
                                style={{ width: `${100 - splitRatio}%` }}
                            >
                                <div className="panel-label">👁️ 预览</div>
                                <div className="split-preview-content">
                                    {previewContent ? (
                                        <MarkdownRenderer content={previewContent} />
                                    ) : (
                                        <div className="preview-placeholder">
                                            <p>左侧输入内容，此处实时预览</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        // 纯编辑模式（无预览）
                        <div className="editor-full-panel">
                            <MarkdownEditor
                                ref={textareaRef}
                                value={content}
                                onChange={handleContentChange}
                                placeholder="开始编写内容...&#x0A;支持 Markdown 语法、LaTeX 公式 ($formula$)、代码块等"
                                minHeight={500}
                            />
                        </div>
                    )
                ) : (
                    // 只读模式
                    <div className="readonly-panel">
                        {content ? (
                            <MarkdownRenderer content={content} />
                        ) : (
                            <div className="zone-page-content-placeholder">
                                <p>该页面暂无内容</p>
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
