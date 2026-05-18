import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', '@libsql/client'],
};

export default nextConfig;
