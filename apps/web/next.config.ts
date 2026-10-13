import type { NextConfig } from "next";

// @greenbuild/db (sign-in, task 30a) is server-only and reads its migrations and the challenges from
// disk, so Node loads it as it is instead of the bundler.
const nextConfig: NextConfig = {
  serverExternalPackages: ["@greenbuild/db"],
};

export default nextConfig;
