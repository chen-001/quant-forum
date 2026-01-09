'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import TableEditor from '@/components/TableEditor';
import { MarkdownEditor } from '@/components/MarkdownRenderer';

export default function NewTablePostPage() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tableInfo, setTableInfo] = useState({
        tableData: [['', '', ''], ['', '', ''], ['', '', '']],
        columnWidths: [150, 150, 150],
        rowHeights: [40, 40, 40]
    });
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

    const handleTableChange = (data) => {
        setTableInfo(data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('请输入帖子标题');
            return;
        }

        // 检查表格是否有内容
        const hasContent = tableInfo.tableData.some(row =>
            row.some(cell => cell.trim() !== '')
        );
        if (!hasContent) {
            setError('表格内容不能为空');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    postType: 'table',
                    tableData: tableInfo.tableData,
                    columnWidths: tableInfo.columnWidths,
                    rowHeights: tableInfo.rowHeights
                })
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
            <main className="container" style={{ maxWidth: '1200px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
                    📊 发布表格帖子
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
                        <label className="form-label">表格内容 *</label>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            点击单元格编辑内容，使用工具栏添加行/列，拖拽边框调整大小
                        </p>
                        <TableEditor
                            initialData={tableInfo.tableData}
                            initialColumnWidths={tableInfo.columnWidths}
                            initialRowHeights={tableInfo.rowHeights}
                            onChange={handleTableChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">补充说明（选填，支持Markdown）</label>
                        <MarkdownEditor
                            value={content}
                            onChange={setContent}
                            placeholder="可以在这里补充说明表格的背景、用途等...&#10;&#10;支持 Markdown 语法，包括：&#10;- LaTeX 公式：$E=mc^2$&#10;- 代码块：```python&#10;- 图片：直接粘贴或上传"
                            minHeight={150}
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
