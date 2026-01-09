/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用 Turbopack，使用 Webpack（解决中文路径问题）
  experimental: {
    // 不使用 turbopack
  },
  // 允许使用 better-sqlite3 原生模块
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
