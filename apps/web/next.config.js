import { networkInterfaces } from 'node:os';

function getLocalNetworkIps() {
  const ips = [];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const addr of addresses ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Testing on a phone over the LAN hits the dev server via this machine's
  // current IP, which changes with DHCP — detect it instead of hardcoding
  // a value that goes stale and silently breaks hydration for LAN clients.
  allowedDevOrigins: getLocalNetworkIps(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

export default nextConfig;
