/** @type {import('next').NextConfig} */
const nextConfig = {
  // Backend URL is read from an env var so it's easy to override in prod
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000",
  },
};

module.exports = nextConfig;
