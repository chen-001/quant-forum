import './globals.css';
import ElectronDragRegion from '@/components/ElectronDragRegion';

// 服务端启动定时任务调度器
if (typeof window === 'undefined') {
  // 使用 process.env 作为进程级别的标志，确保只在应用启动时初始化一次
  // 这在开发模式（HMR重载）和生产模式下都能正确工作
  if (!process.env.__SCHEDULER_INITIALIZED__) {
    process.env.__SCHEDULER_INITIALIZED__ = 'true';
    import('@/lib/scheduler.js').then(({ startScheduler }) => {
      startScheduler();
    });
  }
}

export const metadata = {
  title: 'AI因子讨论区 - 量化研究员交流平台',
  description: '分享AI对话灵感，讨论因子构造思路，记录研究成果',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('theme');
                if (saved) {
                  document.documentElement.setAttribute('data-theme', saved);
                } else if (!window.matchMedia('(prefers-color-scheme: light)').matches) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ElectronDragRegion />
        {children}
      </body>
    </html>
  );
}
