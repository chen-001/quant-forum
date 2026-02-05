'use client';

import Link from 'next/link';
import { useState } from 'react';

function PageTreeItem({ page, zoneId, currentPageId, level = 0, onRefresh }) {
    const [expanded, setExpanded] = useState(true);
    const [showMenu, setShowMenu] = useState(false);
    const [showCreateChild, setShowCreateChild] = useState(false);
    const [newChildTitle, setNewChildTitle] = useState('');
    const [creating, setCreating] = useState(false);

    const isActive = page.id === currentPageId;
    const hasChildren = page.children && page.children.length > 0;
    const maxLevelReached = level >= 3; // 最大4层 (0,1,2,3)

    const handleCreateChild = async () => {
        if (!newChildTitle.trim()) return;
        
        setCreating(true);
        try {
            const res = await fetch(`/api/zones/${zoneId}/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newChildTitle.trim(),
                    parentId: page.id
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                setShowCreateChild(false);
                setNewChildTitle('');
                setExpanded(true);
                onRefresh();
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

    const handleDelete = async () => {
        if (!confirm(`确定要删除页面 "${page.title}" 吗？\n注意：如果有子页面，需要先删除子页面。`)) {
            return;
        }
        
        try {
            const res = await fetch(`/api/zones/pages/${page.id}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                onRefresh();
            } else {
                const data = await res.json();
                alert(data.error || '删除失败');
            }
        } catch (error) {
            console.error('Failed to delete page:', error);
            alert('删除失败');
        }
    };

    return (
        <div className="page-tree-item">
            <div className={`page-tree-row ${isActive ? 'active' : ''}`} style={{ paddingLeft: `${level * 16}px` }}>
                {hasChildren ? (
                    <button
                        className="page-tree-toggle"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? '▼' : '▶'}
                    </button>
                ) : (
                    <span className="page-tree-toggle-placeholder"></span>
                )}
                
                <Link
                    href={`/zones/${zoneId}/${page.path}`}
                    className="page-tree-link"
                >
                    <span className="page-tree-icon">{hasChildren ? '📁' : '📄'}</span>
                    <span className="page-tree-title">{page.title}</span>
                </Link>
                
                <div className="page-tree-actions">
                    <button
                        className="page-tree-menu-btn"
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        ⋮
                    </button>
                    
                    {showMenu && (
                        <div className="page-tree-menu">
                            {!maxLevelReached && (
                                <button
                                    className="page-tree-menu-item"
                                    onClick={() => {
                                        setShowCreateChild(true);
                                        setShowMenu(false);
                                    }}
                                >
                                    添加子页面
                                </button>
                            )}
                            <button
                                className="page-tree-menu-item danger"
                                onClick={() => {
                                    handleDelete();
                                    setShowMenu(false);
                                }}
                            >
                                删除页面
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* 创建子页面输入框 */}
            {showCreateChild && (
                <div className="page-tree-create-child" style={{ paddingLeft: `${(level + 1) * 16}px` }}>
                    <input
                        type="text"
                        value={newChildTitle}
                        onChange={(e) => setNewChildTitle(e.target.value)}
                        placeholder="新页面标题"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateChild();
                            if (e.key === 'Escape') {
                                setShowCreateChild(false);
                                setNewChildTitle('');
                            }
                        }}
                    />
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={handleCreateChild}
                        disabled={!newChildTitle.trim() || creating}
                    >
                        {creating ? '...' : '✓'}
                    </button>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                            setShowCreateChild(false);
                            setNewChildTitle('');
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}
            
            {/* 递归渲染子页面 */}
            {hasChildren && expanded && (
                <div className="page-tree-children">
                    {page.children.map(child => (
                        <PageTreeItem
                            key={child.id}
                            page={child}
                            zoneId={zoneId}
                            currentPageId={currentPageId}
                            level={level + 1}
                            onRefresh={onRefresh}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ZonePageTree({ pages, zoneId, currentPageId, onRefresh }) {
    const [showCreateRoot, setShowCreateRoot] = useState(false);
    const [newPageTitle, setNewPageTitle] = useState('');
    const [creating, setCreating] = useState(false);

    const handleCreateRootPage = async () => {
        if (!newPageTitle.trim()) return;
        
        setCreating(true);
        try {
            const res = await fetch(`/api/zones/${zoneId}/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newPageTitle.trim() })
            });
            
            const data = await res.json();
            if (res.ok) {
                setShowCreateRoot(false);
                setNewPageTitle('');
                onRefresh();
                // 跳转到新页面
                window.location.href = `/zones/${zoneId}/${data.path}`;
            } else {
                alert(data.error || '创建失败');
            }
        } catch (error) {
            console.error('Failed to create page:', error);
            alert('创建失败');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="zone-page-tree">
            <div className="zone-page-tree-header">
                <h3>页面导航</h3>
                <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setShowCreateRoot(true)}
                    title="创建新页面"
                >
                    + 新建
                </button>
            </div>
            
            {showCreateRoot && (
                <div className="page-tree-create-root">
                    <input
                        type="text"
                        value={newPageTitle}
                        onChange={(e) => setNewPageTitle(e.target.value)}
                        placeholder="新页面标题"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateRootPage();
                            if (e.key === 'Escape') {
                                setShowCreateRoot(false);
                                setNewPageTitle('');
                            }
                        }}
                    />
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={handleCreateRootPage}
                        disabled={!newPageTitle.trim() || creating}
                    >
                        {creating ? '...' : '✓'}
                    </button>
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                            setShowCreateRoot(false);
                            setNewPageTitle('');
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}
            
            <div className="zone-page-tree-content">
                {pages.length === 0 ? (
                    <div className="zone-page-tree-empty">
                        <p>暂无页面</p>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowCreateRoot(true)}
                        >
                            创建第一个页面
                        </button>
                    </div>
                ) : (
                    pages.map(page => (
                        <PageTreeItem
                            key={page.id}
                            page={page}
                            zoneId={zoneId}
                            currentPageId={currentPageId}
                            level={0}
                            onRefresh={onRefresh}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
