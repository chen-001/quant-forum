'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { MarkdownEditor } from '@/components/MarkdownRenderer';

export default function EditPostPage({ params }) {
    const { id } = use(params);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [links, setLinks] = useState([{ url: '', title: '' }]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [post, setPost] = useState(null);
    const router = useRouter();

    useEffect(() => {
        checkAuth();
        fetchPost();
    }, [id]);

    const checkAuth = async () => {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.user) {
            router.push('/login');
        } else {
            setUser(data.user);
        }
    };

    const fetchPost = async () => {
        try {
            const res = await fetch(`/api/posts/${id}`);
            const data = await res.json();
            if (res.ok) {
                setPost(data.post);
                setTitle(data.post.title);
                setContent(data.post.content || '');
                if (data.post.links && data.post.links.length > 0) {
                    setLinks(data.post.links.map(l => ({ url: l.url, title: l.title || '' })));
                }
            } else {
                setError('帖子不存在');
            }
        } catch (error) {
            setError('获取帖子失败');
        } finally {
            setLoading(false);
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

        setSubmitting(true);

        try {
            const res = await fetch(`/api/posts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, links: validLinks })
            });

            const data = await res.json();

            if (res.ok) {
                router.push(`/post/${id}`);
            } else {
                setError(data.error || '更新失败');
            }
        } catch (error) {
            setError('网络错误，请重试');
        } finally {
            setSubmitting(false);
        }
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

    // 检查权限
    if (user && post && post.author_id !== user.id) {
        return (
            <>
                <Header />
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div className="empty-state">
                        <p>⚠️ 只有原作者可以编辑帖子</p>
                        <button
                            className="btn btn-primary"
                            style={{ marginTop: '16px' }}
                            onClick={() => router.push(`/post/${id}`)}
                        >
                            返回帖子
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '800px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
                    ✏️ 编辑帖子
                </h1>

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
                            disabled={submitting}
                        >
                            {submitting ? '保存中...' : '保存修改'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-lg"
                            onClick={() => router.push(`/post/${id}`)}
                        >
                            取消
                        </button>
                    </div>
                </form>
            </main>
        </>
    );
}
