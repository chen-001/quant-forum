'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';

/**
 * 识别内容中的代码块
 * @returns Array<{type: 'code'|'text', startLine: number, endLine: number, content: string}>
 */
function parseCodeBlocks(content) {
    const lines = content.split('\n');
    const blocks = [];
    let currentBlock = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isFenceStart = /^```|~~~/.test(line);
        const isFenceEnd = currentBlock?.type === 'code' && /^```|~~~/.test(line);
        const isIndented = /^(\t|    )/.test(line);

        if (isFenceStart && !currentBlock) {
            // 代码块开始
            currentBlock = {
                type: 'code',
                startLine: i,
                content: [line]
            };
        } else if (isFenceEnd && currentBlock?.type === 'code') {
            // 代码块结束
            currentBlock.endLine = i;
            currentBlock.content.push(line);
            blocks.push(currentBlock);
            currentBlock = null;
        } else if (currentBlock?.type === 'code') {
            // 代码块内容
            currentBlock.content.push(line);
        } else if (isIndented && !currentBlock) {
            // 缩进代码块（简化处理，连续缩进行）
            currentBlock = {
                type: 'code',
                startLine: i,
                content: [line]
            };
            let j = i + 1;
            while (j < lines.length && /^(\t|    )/.test(lines[j])) {
                currentBlock.content.push(lines[j]);
                j++;
            }
            currentBlock.endLine = j - 1;
            blocks.push(currentBlock);
            currentBlock = null;
            i = j - 1;
        } else if (!currentBlock) {
            // 普通文本行
            blocks.push({
                type: 'text',
                startLine: i,
                endLine: i,
                content: [line]
            });
        }
    }

    // 处理未闭合的代码块
    if (currentBlock?.type === 'code') {
        currentBlock.endLine = lines.length - 1;
        blocks.push(currentBlock);
    }

    return blocks;
}

// 配置 marked
marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (e) { }
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// 渲染 LaTeX
function renderLatex(text) {
    text = text.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    text = text.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    return text;
}

const HIGHLIGHT_COLORS = [
    { name: 'yellow', color: 'rgba(255, 235, 59, 0.4)' },
    { name: 'green', color: 'rgba(76, 175, 80, 0.4)' },
    { name: 'blue', color: 'rgba(33, 150, 243, 0.4)' },
    { name: 'pink', color: 'rgba(233, 30, 99, 0.4)' },
    { name: 'orange', color: 'rgba(255, 152, 0, 0.4)' }
];

export default function InteractiveContent({ content, postId, user }) {
    const [lineComments, setLineComments] = useState({});
    const [highlights, setHighlights] = useState({});
    const [activeCommentLine, setActiveCommentLine] = useState(null);
    const [newCommentContent, setNewCommentContent] = useState('');
    const [showHighlightToolbar, setShowHighlightToolbar] = useState(false);
    const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
    const [selectedRange, setSelectedRange] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, highlightId: null });
    const contentRef = useRef(null);

    // 将内容分行处理
    const lines = content ? content.split('\n') : [];

    // 解析代码块
    const blocks = useMemo(() => {
        if (!content) return [];
        return parseCodeBlocks(content);
    }, [content]);

    useEffect(() => {
        fetchLineComments();
        fetchHighlights();
    }, [postId]);

    const fetchLineComments = async () => {
        try {
            const res = await fetch(`/api/posts/${postId}/line-comments`);
            const data = await res.json();
            if (res.ok) {
                setLineComments(data.comments || {});
            }
        } catch (error) {
            console.error('Failed to fetch line comments:', error);
        }
    };

    const fetchHighlights = async () => {
        try {
            const res = await fetch(`/api/posts/${postId}/highlights`);
            const data = await res.json();
            if (res.ok) {
                setHighlights(data.highlights || {});
            }
        } catch (error) {
            console.error('Failed to fetch highlights:', error);
        }
    };

    const handleAddComment = async () => {
        if (!newCommentContent.trim() || activeCommentLine === null) return;

        try {
            const res = await fetch(`/api/posts/${postId}/line-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineIndex: activeCommentLine,
                    content: newCommentContent.trim()
                })
            });

            if (res.ok) {
                setNewCommentContent('');
                await fetchLineComments();
                // 保持评论面板打开以显示新评论
            } else {
                const data = await res.json();
                alert(data.error || '添加评论失败');
            }
        } catch (error) {
            console.error('Failed to add comment:', error);
            alert('添加评论失败，请重试');
        }
    };

    const handleTextSelection = useCallback((lineIndex) => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            setShowHighlightToolbar(false);
            return;
        }

        const text = selection.toString().trim();
        if (!text) {
            setShowHighlightToolbar(false);
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 计算选中文本在行内的偏移
        const lineElement = document.querySelector(`[data-line-index="${lineIndex}"]`);
        if (lineElement) {
            const lineText = lineElement.textContent || '';
            const selectedText = selection.toString();
            const startOffset = lineText.indexOf(selectedText);
            const endOffset = startOffset + selectedText.length;

            setSelectedRange({
                lineIndex,
                startOffset,
                endOffset,
                text: selectedText
            });

            setToolbarPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 10
            });
            setShowHighlightToolbar(true);
        }
    }, []);

    const handleAddHighlight = async (color) => {
        if (!selectedRange || !user) return;

        try {
            const res = await fetch(`/api/posts/${postId}/highlights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineIndex: selectedRange.lineIndex,
                    startOffset: selectedRange.startOffset,
                    endOffset: selectedRange.endOffset,
                    color
                })
            });

            if (res.ok) {
                fetchHighlights();
                setShowHighlightToolbar(false);
                window.getSelection()?.removeAllRanges();
            }
        } catch (error) {
            console.error('Failed to add highlight:', error);
        }
    };

    const handleRemoveHighlight = async (highlightId) => {
        try {
            const res = await fetch(`/api/posts/${postId}/highlights`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ highlightId })
            });

            if (res.ok) {
                fetchHighlights();
            }
        } catch (error) {
            console.error('Failed to remove highlight:', error);
        }
    };

    // 应用高亮到文本
    const applyHighlights = (text, lineHighlights) => {
        if (!lineHighlights || lineHighlights.length === 0) {
            return text;
        }

        // 按开始位置排序
        const sorted = [...lineHighlights].sort((a, b) => a.start_offset - b.start_offset);
        let result = '';
        let lastEnd = 0;

        sorted.forEach(h => {
            // 跳过已经被处理过的区域（处理重叠情况）
            if (h.start_offset < lastEnd) {
                // 如果这个高亮完全在之前的高亮范围内，跳过
                if (h.end_offset <= lastEnd) {
                    return;
                }
                // 部分重叠，只处理不重叠的部分
                const colorObj = HIGHLIGHT_COLORS.find(c => c.name === h.color) || HIGHLIGHT_COLORS[0];
                result += `<mark style="background: ${colorObj.color}; padding: 2px 0; border-radius: 2px; cursor: pointer;" data-highlight-id="${h.id}">${text.slice(lastEnd, h.end_offset)}</mark>`;
                lastEnd = h.end_offset;
                return;
            }

            const colorObj = HIGHLIGHT_COLORS.find(c => c.name === h.color) || HIGHLIGHT_COLORS[0];
            result += text.slice(lastEnd, h.start_offset);
            result += `<mark style="background: ${colorObj.color}; padding: 2px 0; border-radius: 2px; cursor: pointer;" data-highlight-id="${h.id}">${text.slice(h.start_offset, h.end_offset)}</mark>`;
            lastEnd = Math.max(lastEnd, h.end_offset);
        });

        result += text.slice(lastEnd);
        return result;
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

    // 处理点击高亮删除
    const handleContentClick = (e) => {
        const mark = e.target.closest('mark[data-highlight-id]');
        if (mark && user) {
            e.preventDefault();
            e.stopPropagation();
            const highlightId = mark.getAttribute('data-highlight-id');
            setDeleteConfirm({ show: true, highlightId: parseInt(highlightId) });
        }
    };

    const confirmDeleteHighlight = () => {
        if (deleteConfirm.highlightId) {
            handleRemoveHighlight(deleteConfirm.highlightId);
        }
        setDeleteConfirm({ show: false, highlightId: null });
    };

    const cancelDeleteHighlight = () => {
        setDeleteConfirm({ show: false, highlightId: null });
    };

    // 渲染单行文本
    const renderLine = (line, index) => {
        const lineHighlights = highlights[index] || [];
        const lineCommentsArr = lineComments[index] || [];
        const hasComments = lineCommentsArr.length > 0;
        const isActiveComment = activeCommentLine === index;

        let renderedLine = line ? marked.parseInline(line) : '&nbsp;';
        renderedLine = renderLatex(renderedLine);

        if (lineHighlights.length > 0) {
            renderedLine = applyHighlights(line, lineHighlights);
            renderedLine = marked.parseInline(renderedLine);
            renderedLine = renderLatex(renderedLine);
        }

        return (
            <div key={index} className="interactive-line-wrapper">
                <div
                    className={`interactive-line ${hasComments ? 'has-comments' : ''}`}
                    data-line-index={index}
                    onMouseUp={() => handleTextSelection(index)}
                >
                    <span
                        className="line-content"
                        dangerouslySetInnerHTML={{ __html: renderedLine }}
                    />
                    <button
                        className={`line-comment-btn ${hasComments ? 'has-comments' : ''} ${isActiveComment ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveCommentLine(isActiveComment ? null : index);
                        }}
                        title={hasComments ? `${lineCommentsArr.length} 条评论` : '添加评论'}
                    >
                        💬 {hasComments && <span className="comment-count">{lineCommentsArr.length}</span>}
                    </button>
                </div>

                {isActiveComment && (
                    <div className="line-comments-panel">
                        {lineCommentsArr.length > 0 && (
                            <div className="line-comments-list">
                                {lineCommentsArr.map(comment => (
                                    <div key={comment.id} className="line-comment-item">
                                        <div className="line-comment-header">
                                            <span className="line-comment-author">{comment.author_name}</span>
                                            <span className="line-comment-time">{formatDate(comment.created_at)}</span>
                                        </div>
                                        <div className="line-comment-content">{comment.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {user ? (
                            <div className="line-comment-input">
                                <textarea
                                    value={newCommentContent}
                                    onChange={(e) => setNewCommentContent(e.target.value)}
                                    placeholder="写下你对这行的评论..."
                                    rows={2}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleAddComment}
                                    disabled={!newCommentContent.trim()}
                                >
                                    发送
                                </button>
                            </div>
                        ) : (
                            <div className="line-comment-login-hint">
                                <a href="/login">登录</a> 后可添加评论
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // 渲染代码块
    const renderCodeBlock = (block, blockIndex) => {
        const blockContent = block.content.join('\n');
        const lineCommentsArr = lineComments[block.startLine] || [];
        const hasComments = lineCommentsArr.length > 0;
        const isActiveComment = activeCommentLine === block.startLine;

        // 使用完整渲染
        let renderedBlock = marked.parse(blockContent);
        // 代码块内不渲染 LaTeX，避免误处理代码中的 $ 符号

        return (
            <div key={`block-${blockIndex}`} className="interactive-line-wrapper code-block-wrapper">
                <div
                    className={`interactive-line code-block-line ${hasComments ? 'has-comments' : ''}`}
                    data-line-index={block.startLine}
                >
                    <div
                        className="line-content code-block-content"
                        dangerouslySetInnerHTML={{ __html: renderedBlock }}
                    />
                    <button
                        className={`line-comment-btn ${hasComments ? 'has-comments' : ''} ${isActiveComment ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveCommentLine(isActiveComment ? null : block.startLine);
                        }}
                        title={hasComments ? `${lineCommentsArr.length} 条评论` : '添加评论'}
                    >
                        💬 {hasComments && <span className="comment-count">{lineCommentsArr.length}</span>}
                    </button>
                </div>

                {isActiveComment && (
                    <div className="line-comments-panel">
                        {lineCommentsArr.length > 0 && (
                            <div className="line-comments-list">
                                {lineCommentsArr.map(comment => (
                                    <div key={comment.id} className="line-comment-item">
                                        <div className="line-comment-header">
                                            <span className="line-comment-author">{comment.author_name}</span>
                                            <span className="line-comment-time">{formatDate(comment.created_at)}</span>
                                        </div>
                                        <div className="line-comment-content">{comment.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {user ? (
                            <div className="line-comment-input">
                                <textarea
                                    value={newCommentContent}
                                    onChange={(e) => setNewCommentContent(e.target.value)}
                                    placeholder="写下你对代码块的评论..."
                                    rows={2}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleAddComment}
                                    disabled={!newCommentContent.trim()}
                                >
                                    发送
                                </button>
                            </div>
                        ) : (
                            <div className="line-comment-login-hint">
                                <a href="/login">登录</a> 后可添加评论
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="interactive-content" ref={contentRef}>
            {/* 高亮颜色选择工具栏 */}
            {showHighlightToolbar && user && (
                <div
                    className="highlight-toolbar"
                    style={{
                        position: 'fixed',
                        left: toolbarPosition.x,
                        top: toolbarPosition.y,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 1000
                    }}
                >
                    {HIGHLIGHT_COLORS.map(({ name, color }) => (
                        <button
                            key={name}
                            className="highlight-color-btn"
                            style={{ background: color }}
                            onClick={() => handleAddHighlight(name)}
                            title={`高亮为${name}`}
                        />
                    ))}
                </div>
            )}

            {/* 删除高亮确认模态框 */}
            {deleteConfirm.show && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000
                    }}
                    onClick={cancelDeleteHighlight}
                >
                    <div
                        style={{
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '24px',
                            maxWidth: '320px',
                            textAlign: 'center',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p style={{ marginBottom: '20px', color: 'var(--text-primary)', fontSize: '16px' }}>
                            删除此高亮标注？
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={cancelDeleteHighlight}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmDeleteHighlight}
                                style={{ background: 'var(--error)' }}
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 逐行渲染内容 */}
            <div className="interactive-lines" onClick={handleContentClick}>
                {blocks.map((block, blockIndex) => {
                    if (block.type === 'code') {
                        // 渲染代码块
                        return renderCodeBlock(block, blockIndex);
                    } else {
                        // 渲染文本行
                        return block.content.map((line, lineIndex) => {
                            const actualLineIndex = block.startLine + lineIndex;
                            return renderLine(line, actualLineIndex);
                        });
                    }
                })}
            </div>
        </div>
    );
}
