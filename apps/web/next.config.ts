import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
  }
};

export default nextConfig;
