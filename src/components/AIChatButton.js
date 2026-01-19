'use client';

import AIChatWidget from './AIChatWidget';

/**
 * AI聊天浮动按钮组件
 * @param {string} pageType - 页面类型
 * @param {number} contextId - 上下文ID（如帖子ID）
 */
export default function AIChatButton({ pageType, contextId = null }) {
  return <AIChatWidget pageType={pageType} contextId={contextId} />;
}
