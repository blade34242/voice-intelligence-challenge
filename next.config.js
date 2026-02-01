/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  assetPrefix: './',
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
