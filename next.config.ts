/** @type {import('next').NextConfig} */
const nextConfig: import('next').NextConfig = {
  // パフォーマンス最適化
  experimental: {
    // Server Components の最適化
    serverComponentsExternalPackages: ['openai'],
    // より高速なビルド
    turbo: {
      loaders: {
        '.svg': ['@svgr/webpack'],
      },
    },
    // トレーシング設定
  },

  // 本番環境でのパフォーマンス最適化
  compiler: {
    // 本番環境でコンソールログを削除
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 静的ファイルの最適化
  images: {
    // 画像最適化の設定
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1年
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // 圧縮設定
  compress: true,

  // PoweredBy ヘッダーを無効化
  poweredByHeader: false,

  // 開発時のパフォーマンス設定
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 本番環境での最適化
    if (!dev && !isServer) {
      // バンドルサイズの最適化
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
      };
    }

    return config;
  },

  // 環境変数の検証
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // TypeScript の厳密チェック
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint の厳密チェック
  eslint: {
    ignoreDuringBuilds: false,
  },

  // リダイレクト設定
  async redirects() {
    return [];
  },

  // リライト設定（必要に応じて）
  async rewrites() {
    return [];
  },

  // 出力設定（静的エクスポート用）
  // トレーシング設定
  // experimental オプションは上部で統合されました
    instrumentationHook: true,
  };


module.exports = nextConfig;