require('dotenv').config();
import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: false,

    // Indicate that these packages should not be bundled by webpack
    serverExternalPackages: [
        "sharp",
        "onnxruntime-node",
        "@zilliz/milvus2-sdk-node",
        "@boundaryml/baml",
        "pg",
        "playwright-core", // Add playwright-core to serverExternalPackages
      ],
    
    webpack: (config, { isServer }) => {
      if (isServer) {
        config.externals.push('@boundaryml/baml');
        config.externals.push('webworker-threads');
        config.externals.push('playwright-core'); // Add playwright-core to externals
      }

      // Add path aliases to webpack
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
        '@/components': path.resolve(__dirname, 'src/components'),
        '@/components/ui': path.resolve(__dirname, 'src/components/ui'),
        '@/hooks': path.resolve(__dirname, 'src/hooks'),
        '@/lib': path.resolve(__dirname, 'src/lib'),
      };

      // Handle .node files
      config.module.rules.push({
        test: /\.node$/,
        use: 'node-loader',
      });
      
      return config;
    },
};

export default nextConfig;
