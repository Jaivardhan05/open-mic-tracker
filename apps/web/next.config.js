/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.29.69'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
};

export default nextConfig;
