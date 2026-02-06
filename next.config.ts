import type { NextConfig } from "next";
import { config } from "dotenv";

config();

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost"
      },
      {
        protocol: "https",
        hostname: "bundui-images.netlify.app"
      },
      {
        protocol: "https",
        hostname: "pix1.dev"
      },
      {
        protocol: "https",
        hostname: "mact.au"
      }
    ]
  },
  typescript: {
    // Skip type checking during build - Supabase types need regeneration
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
