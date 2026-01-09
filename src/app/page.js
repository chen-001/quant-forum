'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { RatingBadges } from '@/components/RatingPanel';

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

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');

  useEffect(() => {
    fetchPosts();
  }, [sortBy]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?orderBy=${sortBy}&order=DESC`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Header />
      <main className="container">
        <div className="posts-header">
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
            💡 帖子列表
          </h1>

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
          <div className="posts-grid">
            {posts.map(post => (
              <Link href={`/post/${post.id}`} key={post.id} style={{ textDecoration: 'none' }}>
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
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
