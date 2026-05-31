import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/smemlab/",
  plugins: [react()],
  server: { port: 5173, open: false }
});
