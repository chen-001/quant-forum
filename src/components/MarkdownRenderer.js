'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';

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
    // 行内公式 $...$
    text = text.replace(/\$([^\$\n]+)\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    // 块级公式 $$...$$
    text = text.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
        try {
            return katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch (e) {
            return match;
        }
    });

    return text;
}

export default function MarkdownRenderer({ content }) {
    const [html, setHtml] = useState('');

    useEffect(() => {
        if (!content) {
            setHtml('');
            return;
        }

        let rendered = marked.parse(content);
        rendered = renderLatex(rendered);
        setHtml(rendered);
    }, [content]);

    return (
        <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

// Markdown 编辑器组件
export function MarkdownEditor({ value, onChange, placeholder, minHeight = 120 }) {
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
    }, []);

    const uploadFile = async (file) => {
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
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await uploadFile(file);
            e.target.value = '';
        }
    };

    return (
        <div className="markdown-editor">
            <div className="editor-toolbar" style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '8px',
                padding: '8px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)'
            }}>
                <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer' }}>
                    {uploading ? '上传中...' : '📎 上传文件'}
                    <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.py,.js"
                    />
                </label>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    支持粘贴图片
                </span>
            </div>
            <textarea
                ref={textareaRef}
                className="textarea"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onPaste={handlePaste}
                placeholder={placeholder}
                style={{ minHeight }}
            />
        </div>
    );
}
