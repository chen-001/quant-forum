'use client';

import { useState, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import ContextMenu from './ContextMenu';

/**
 * 交互式Markdown渲染器包装组件
 * 支持右键菜单收藏和添加到待办功能
 *
 * @param {Object} props
 * @param {string} props.content - Markdown内容
 * @param {string} props.contentType - 内容类型: 'comment' | 'result' | 'idea'
 * @param {string} props.postId - 帖子ID
 * @param {string} [props.commentId] - 评论ID（comment类型时需要）
 * @param {string} [props.resultId] - 成果ID（result类型时需要）
 * @param {Object} props.user - 用户对象
 */
export default function InteractiveMarkdownRenderer({
    content,
    contentType,
    postId,
    commentId,
    resultId,
    user
}) {
    const [contextMenu, setContextMenu] = useState(null);
    const containerRef = useRef(null);

    const handleContextMenu = (e) => {
        // 如果是图片，不阻止默认行为，显示浏览器原生右键菜单
        if (e.target.tagName === 'IMG' || e.target.closest('img')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (!user) return;

        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText) {
            setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'text',
                data: { text: selectedText }
            });
        }
        // 如果没有选中文本，不显示菜单
    };

    const handleFavorite = async (imageUrl) => {
        // 灯箱中的收藏（接收图片URL）
        if (imageUrl) {
            try {
                const body = {
                    contentType,
                    postId,
                    ...(commentId && { commentId }),
                    ...(resultId && { resultId }),
                    imageUrl
                };

                const res = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    alert('收藏成功！');
                } else {
                    const data = await res.json();
                    alert(data.error || '收藏失败');
                }
            } catch (error) {
                console.error('Failed to favorite:', error);
                alert('收藏失败');
            }
            return;
        }

        // 右键菜单的收藏（文本选择）
        if (!contextMenu) return;

        try {
            const body = {
                contentType,
                postId,
                ...(commentId && { commentId }),
                ...(resultId && { resultId }),
                textData: contextMenu.data.text
            };

            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert('收藏成功！');
            } else {
                const data = await res.json();
                alert(data.error || '收藏失败');
            }
        } catch (error) {
            console.error('Failed to favorite:', error);
            alert('收藏失败');
        }
    };

    const handleTodo = async (imageUrl) => {
        // 灯箱中的待办（接收图片URL）
        if (imageUrl) {
            try {
                const body = {
                    contentType,
                    postId,
                    ...(commentId && { commentId }),
                    ...(resultId && { resultId }),
                    imageUrl
                };

                const res = await fetch('/api/todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    alert('已添加到待办！');
                } else {
                    const data = await res.json();
                    alert(data.error || '添加失败');
                }
            } catch (error) {
                console.error('Failed to add todo:', error);
                alert('添加失败');
            }
            return;
        }

        // 右键菜单的待办（文本选择）
        if (!contextMenu) return;

        try {
            const body = {
                contentType,
                postId,
                ...(commentId && { commentId }),
                ...(resultId && { resultId }),
                textData: contextMenu.data.text
            };

            const res = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert('已添加到待办！');
            } else {
                const data = await res.json();
                alert(data.error || '添加失败');
            }
        } catch (error) {
            console.error('Failed to add todo:', error);
            alert('添加失败');
        }
    };

    const handleCopy = async () => {
        if (!contextMenu) return;

        const { type, data } = contextMenu;

        // 复制文本的辅助函数
        const copyToClipboard = async (text) => {
            // 方法1：使用现代 Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (e) {
                    console.warn('Clipboard API failed, trying fallback:', e);
                }
            }

            // 方法2：使用传统 execCommand 方法
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (e) {
                console.error('execCommand failed:', e);
                return false;
            }
        };

        try {
            if (type === 'text') {
                await copyToClipboard(data.text);
            }
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    return (
        <div
            ref={containerRef}
            className="interactive-markdown-container"
            onContextMenu={handleContextMenu}
        >
            <MarkdownRenderer
                content={content}
                postId={postId}
                onFavorite={handleFavorite}
                onTodo={handleTodo}
                user={user}
            />
            {contextMenu && (
                <ContextMenu
                    position={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onFavorite={handleFavorite}
                    onTodo={handleTodo}
                    onCopy={handleCopy}
                    user={user}
                />
            )}
        </div>
    );
}
