import './globals.css';
import ElectronDragRegion from '@/components/ElectronDragRegion';

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
      </head>
      <body suppressHydrationWarning>
        <ElectronDragRegion />
        {children}
      </body>
    </html>
  );
}
