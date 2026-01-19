'use client';

/**
 * AI聊天悬浮按钮组件
 * @param {Function} onClick - 点击回调
 * @param {boolean} isVisible - 是否可见
 */
export default function FloatingButton({ onClick, isVisible = true }) {
  if (!isVisible) return null;

  return (
    <button
      onClick={onClick}
      className="ai-chat-floating-button"
      title="AI问答"
      aria-label="打开AI聊天"
    >
      <svg className="ai-chat-floating-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    </button>
  );
}
