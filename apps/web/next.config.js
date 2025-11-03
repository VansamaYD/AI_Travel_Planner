// Polyfill server globals required by some libs (Headers, Request) when Node runtime lacks web globals.
try {
	require('./polyfills.server');
} catch (e) {
	// ignore if not present
}

/** @type {import('next').NextConfig} */
module.exports = {
	reactStrictMode: false,
	output: 'standalone', // Enable standalone output for Docker
};
