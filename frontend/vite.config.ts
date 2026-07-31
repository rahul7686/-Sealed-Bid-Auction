import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills(),
    {
      name: 'fix-midnight-wallet-kit-imports',
      transform(code, id) {
        if (id.includes('midnight-wallet-kit')) {
          return code.replace(/await new Function\('return import\("([^"]+)"\)'\)\(\)/g, 'await import("$1")');
        }
      }
    }
  ],
  build: {
    target: "esnext"
  },
  server: { port: 5173 }
});
