// Polyfill server globals required by some libs (Headers, Request) when Node runtime lacks web globals.
try {
	require('./polyfills.server');
} catch (e) {
	// ignore if not present
}

/** @type {import('next').NextConfig} */
module.exports = {
	reactStrictMode: false,
	// 暂时不使用 standalone 模式，避免 ESM/CommonJS 兼容性问题
	// output: 'standalone',
	transpilePackages: ['swr'], // 强制转换 SWR 为 CommonJS
};
