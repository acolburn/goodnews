import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
const isNetlify = process.env.NETLIFY === "true" || process.env.NETLIFY === "1";

export default defineConfig({
  base: isNetlify ? "/" : "/goodnews/",
  plugins: [react(), tailwindcss()],
});
