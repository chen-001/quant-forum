'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { RatingBadges } from '@/components/RatingPanel';
import AIChatButton from '@/components/AIChatButton';

const SORT_OPTIONS = [
  { key: 'created_at', label: '最新发帖' },
  { key: 'updated_at', label: '最近更新' },
  { key: 'avg_total', label: '综合评分' },
  { key: 'avg_novelty', label: '另类程度' },
  { key: 'avg_test_effect', label: '测试效果' },
  { key: 'avg_creativity', label: '构造新颖' },
  { key: 'avg_fun', label: '想法趣味' },
  { key: 'avg_completeness', label: '完善程度' },
];

// 格式化日期函数（移到组件外，避免每次渲染重新创建）
function formatDate(dateStr) {
  const date = new Date(dateStr + 'Z');
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai'
  });
}

// 优化后的PostCard组件
const PostCard = memo(function PostCard({ post }) {
  return (
    <article className="post-card">
      <div className="post-info">
        <h2 className="post-title">
          {post.is_pinned ? (
            <span style={{
              marginRight: '8px',
              padding: '2px 6px',
              background: 'var(--warning)',
              color: '#000',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600'
            }}>📌 置顶</span>
          ) : null}
          {post.title}
        </h2>
        <div className="post-meta">
          <span className="post-meta-item">
            👤 {post.author_name}
          </span>
          <span className="post-meta-item">
            📅 {formatDate(post.created_at)}
          </span>
          <span className="post-meta-item">
            🔗 {post.link_count} 个链接
          </span>
          <span className="post-meta-item">
            💬 {post.comment_count} 条评论
          </span>
        </div>
      </div>
      <RatingBadges ratings={post} />
    </article>
  );
});

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/posts?orderBy=${sortBy}&order=DESC`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, searchQuery]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  // 缓存帖子列表渲染
  const postsGrid = useMemo(() => (
    <div className="posts-grid">
      {posts.map(post => (
        <Link href={`/post/${post.id}`} key={post.id} style={{ textDecoration: 'none' }}>
          <PostCard post={post} />
        </Link>
      ))}
    </div>
  ), [posts]);

  return (
    <>
      <Header />
      <AIChatButton pageType="home" />
      <main className="container">
        <div className="posts-header">
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
            💡 帖子列表
          </h1>

          {/* 搜索栏 */}
          <form onSubmit={handleSearch} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="🔍 搜索帖子（标题、作者、内容、评论等）..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button type="submit" className="btn btn-primary">
                搜索
              </button>
            </div>
            {searchQuery && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                搜索 "{searchQuery}" 找到 {posts.length} 个结果
              </div>
            )}
          </form>

          <div className="sort-tabs">
            {SORT_OPTIONS.map(option => (
              <button
                key={option.key}
                className={`sort-tab ${sortBy === option.key ? 'active' : ''}`}
                onClick={() => setSortBy(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>还没有帖子，快来发布第一个吧！</p>
            <Link href="/post/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
              ✏️ 发布帖子
            </Link>
          </div>
        ) : (
          postsGrid
        )}
      </main>
    </>
  );
}
