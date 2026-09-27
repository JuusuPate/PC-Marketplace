import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// A separate local preview. Never writes env files or contacts the live database.
const server = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  {
    cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
    env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "", VITE_SUPABASE_ANON_KEY: "" },
    stdio: "inherit",
    windowsHide: true,
  },
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));
