// The site moved to www.telad-group.com (24/11): the old Vercel addresses send every path there.
// (Preview deployments keep their own addresses.)
const OLD_HOSTS = ['telad.vercel.app', 'telad-khaki.vercel.app'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return OLD_HOSTS.map((host) => ({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: 'https://www.telad-group.com/:path*',
      permanent: true,
    }));
  },
};

export default nextConfig;
