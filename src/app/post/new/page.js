'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { MarkdownEditor } from '@/components/MarkdownRenderer';

export default function NewPostPage() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [links, setLinks] = useState([{ url: '', title: '' }]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const router = useRouter();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.user) {
            router.push('/login');
        } else {
            setUser(data.user);
        }
    };

    const addLink = () => {
        if (links.length < 100) {
            setLinks([...links, { url: '', title: '' }]);
        }
    };

    const removeLink = (index) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const updateLink = (index, field, value) => {
        const newLinks = [...links];
        newLinks[index][field] = value;
        setLinks(newLinks);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const validLinks = links.filter(link => link.url.trim());

        setLoading(true);

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, links: validLinks })
            });

            const data = await res.json();

            if (res.ok) {
                router.push(`/post/${data.postId}`);
            } else {
                setError(data.error || '发帖失败');
            }
        } catch (error) {
            setError('网络错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <>
                <Header />
                <div className="loading">
                    <div className="spinner"></div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '800px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
                    ✏️ 发布新帖子
                </h1>

                {/* 帖子类型选择 */}
                <div className="post-type-selector">
                    <div
                        className="post-type-option selected"
                        onClick={() => { }}
                    >
                        <div className="post-type-icon">🔗</div>
                        <div className="post-type-label">链接帖子</div>
                        <div className="post-type-desc">分享AI对话链接</div>
                    </div>
                    <div
                        className="post-type-option"
                        onClick={() => router.push('/post/new-table')}
                    >
                        <div className="post-type-icon">📊</div>
                        <div className="post-type-label">表格帖子</div>
                        <div className="post-type-desc">创建可编辑表格</div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">帖子标题 *</label>
                        <input
                            type="text"
                            className="input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="请输入帖子标题"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">AI对话链接（选填，可添加多个）</label>
                        <div className="links-input">
                            {links.map((link, index) => (
                                <div key={index} className="link-input-row">
                                    <input
                                        type="url"
                                        className="input"
                                        value={link.url}
                                        onChange={(e) => updateLink(index, 'url', e.target.value)}
                                        placeholder="https://chat.openai.com/share/..."
                                        style={{ flex: 2 }}
                                    />
                                    <input
                                        type="text"
                                        className="input"
                                        value={link.title}
                                        onChange={(e) => updateLink(index, 'title', e.target.value)}
                                        placeholder="链接标题（选填）"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => removeLink(index)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={addLink}
                                style={{ alignSelf: 'flex-start' }}
                            >
                                + 添加链接
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">正文内容（选填，支持Markdown）</label>
                        <MarkdownEditor
                            value={content}
                            onChange={setContent}
                            placeholder="可以在这里补充说明这个想法的背景、思路等...&#10;&#10;支持 Markdown 语法，包括：&#10;- LaTeX 公式：$E=mc^2$&#10;- 代码块：```python&#10;- 图片：直接粘贴或上传"
                            minHeight={200}
                        />
                    </div>

                    {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading}
                        >
                            {loading ? '发布中...' : '发布帖子'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-lg"
                            onClick={() => router.back()}
                        >
                            取消
                        </button>
                    </div>
                </form>
            </main>
        </>
    );
}
