/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许使用 better-sqlite3 原生模块
  serverExternalPackages: ['better-sqlite3'],

  // 生产环境优化
  compress: true,
  poweredByHeader: false,

  // 禁用请求日志
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // 实验性功能
  experimental: {
    // 启用 optimizePackageImports 自动优化导入
    optimizePackageImports: ['marked', 'highlight.js', 'katex'],
  },

  // Turbopack配置（Next.js 16默认使用）
  turbopack: {},
};

export default nextConfig;
