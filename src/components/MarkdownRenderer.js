'use client';

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';
import ImageLightbox from './ImageLightbox';

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

// 简单的LRU缓存实现
class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return undefined;
        // 访问时移动到末尾（最近使用）
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // 删除最久未使用的（第一个）
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }
}

// 使用LRU缓存替代普通Map
const latexCache = new LRUCache(100);
const markdownCache = new LRUCache(50);

// 渲染 LaTeX（带LRU缓存）
function renderLatex(text) {
    if (latexCache.has(text)) {
        return latexCache.get(text);
    }

    let result = text;

    // 行内公式 $...$
    result = result.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // 块级公式 $$...$$
    result = result.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    latexCache.set(text, result);
    return result;
}

function parseMarkdown(content) {
    if (!content) return '';

    if (markdownCache.has(content)) {
        return markdownCache.get(content);
    }

    let rendered = marked.parse(content);
    rendered = renderLatex(rendered);

    markdownCache.set(content, rendered);
    return rendered;
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content, postId, onFavorite, onTodo, user }) {
    // 使用useMemo缓存HTML解析结果
    const html = useMemo(() => parseMarkdown(content), [content]);

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [currentImage, setCurrentImage] = useState(null);
    const containerRef = useRef(null);

    const handleImageClick = useCallback((e) => {
        const img = e.target.closest('img');
        if (img && !img.closest('.no-lightbox')) {
            e.preventDefault();
            e.stopPropagation();
            setCurrentImage({
                src: img.src,
                alt: img.alt || img.title || ''
            });
            setLightboxOpen(true);
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('click', handleImageClick);
        return () => container.removeEventListener('click', handleImageClick);
    }, [handleImageClick]);

    return (
        <>
            <div
                ref={containerRef}
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: html }}
            />
            <ImageLightbox
                isOpen={lightboxOpen}
                image={currentImage}
                postId={postId}
                onClose={() => setLightboxOpen(false)}
                onFavorite={onFavorite}
                onTodo={onTodo}
                user={user}
            />
        </>
    );
});

export default MarkdownRenderer;

// Markdown 编辑器组件
export const MarkdownEditor = memo(function MarkdownEditor({ value, onChange, placeholder, minHeight = 120 }) {
    const textareaRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handlePaste = useCallback(async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await uploadFile(file);
                }
                break;
            }
        }
    }, [onChange, value]);

    const uploadFile = useCallback(async (file) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

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

                const textarea = textareaRef.current;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newValue = value.slice(0, start) + markdown + value.slice(end);
                onChange(newValue);
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setUploading(false);
        }
    }, [value, onChange]);

    const handleFileSelect = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await uploadFile(file);
            e.target.value = '';
        }
    }, [uploadFile]);

    return (
        <div className="markdown-editor">
            <div className="editor-input-wrapper">
                <textarea
                    ref={textareaRef}
                    className="textarea"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={placeholder}
                    style={{ minHeight }}
                />
                <label className="upload-icon-btn" title="上传文件">
                    {uploading ? '⏳' : '📎'}
                    <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.py,.js"
                    />
                </label>
            </div>
        </div>
    );
});
