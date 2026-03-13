import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // basePath is needed when deployed to a GitHub Pages project subdirectory.
  // Set NEXT_PUBLIC_BASE_PATH=/RepoName in the GitHub Actions build step.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
  }
};

export default nextConfig;
