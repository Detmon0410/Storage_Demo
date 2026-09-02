import { spawn } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = new Set();

function run(name, args) {
  const child = spawn(pnpm, args, { stdio: "inherit", shell: true });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (signal) return;
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      stopAll(code);
    }
  });
  return child;
}

function stopAll(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

async function backendIsUp() {
  try {
    const response = await fetch("http://127.0.0.1:4000/health");
    return response.ok;
  } catch {
    return false;
  }
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

if (await backendIsUp()) {
  console.log("Backend already running on http://127.0.0.1:4000");
} else {
  run("backend", ["--filter", "backend", "host"]);
}

run("frontend", ["--filter", "frontend", "host"]);
