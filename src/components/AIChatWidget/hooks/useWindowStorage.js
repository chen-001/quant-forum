'use client';

import { useEffect, useState } from 'react';

/**
 * localStorage状态持久化Hook
 * @param {string} key - 存储键名
 * @param {any} defaultValue - 默认值
 */
export function useWindowStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * 窗口状态持久化Hook
 */
export function useWindowStateStorage() {
  return useWindowStorage('ai-chat-widget-window-state', 'closed');
}
