#!/usr/bin/env tsx
/**
 * Startup script for Simple Router Agent System
 * Starts all three agents: Router, Lead Manager, and Content Editor
 * Handles port cleanup to avoid orphaned processes
 */

import { spawn, ChildProcess, exec } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Agent configurations
const agents = [
  {
    name: "Simple Router",
    script: path.join(__dirname, "index.ts"),
    port: 41250,
    color: "\x1b[36m", // Cyan
  },
  {
    name: "Lead Manager",
    script: path.join(__dirname, "..", "lead-manager", "index.ts"),
    port: 41245,
    color: "\x1b[33m", // Yellow
  },
  {
    name: "Content Editor",
    script: path.join(__dirname, "..", "content-editor", "index.ts"),
    port: 10003,
    color: "\x1b[35m", // Magenta
  },
];

const processes: ChildProcess[] = [];
const reset = "\x1b[0m";

/**
 * Kill any process using the specified port
 */
async function killPortProcess(port: number): Promise<void> {
  try {
    // Find process using the port (works on macOS/Linux)
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout.trim().split('\n').filter(pid => pid);
    
    if (pids.length > 0) {
      console.log(`🔧 Cleaning up port ${port} (PIDs: ${pids.join(', ')})`);
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
        } catch (e) {
          // Process might already be dead
        }
      }
      // Wait a moment for port to be released
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    // No process found on port, which is fine
  }
}

/**
 * Clean up all agent ports before starting
 */
async function cleanupPorts(): Promise<void> {
  console.log("🧹 Checking for processes on agent ports...\n");
  for (const agent of agents) {
    await killPortProcess(agent.port);
  }
}

console.log("\n" + "=".repeat(80));
console.log("🚀 Starting Simple Router Agent System");
console.log("=".repeat(80) + "\n");

// Clean up ports before starting
await cleanupPorts();

// Start each agent
agents.forEach((agent) => {
  console.log(`${agent.color}[${agent.name}]${reset} Starting on port ${agent.port}...`);

  const proc = spawn("npx", ["tsx", agent.script], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  proc.stdout?.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.log(`${agent.color}[${agent.name}]${reset} ${line}`);
      }
    });
  });

  proc.stderr?.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.error(`${agent.color}[${agent.name}]${reset} ERROR: ${line}`);
      }
    });
  });

  proc.on("exit", (code) => {
    console.log(`${agent.color}[${agent.name}]${reset} Exited with code ${code}`);
  });

  processes.push(proc);
});

// Wait a moment for agents to start, then print summary
setTimeout(() => {
  console.log("\n" + "=".repeat(80));
  console.log("✅ All agents started successfully!");
  console.log("=".repeat(80) + "\n");

  console.log("📋 Agent Card URLs for Testing:\n");

  agents.forEach((agent) => {
    console.log(`${agent.color}${agent.name}:${reset}`);
    console.log(`   http://localhost:${agent.port}/.well-known/agent-card.json\n`);
  });

  console.log("=".repeat(80));
  console.log("💡 Usage Examples:\n");
  console.log("1. Send a lead scoring request to the Router:");
  console.log('   "Score this lead for Acme Corp in the software industry"\n');
  console.log("2. Send a content editing request to the Router:");
  console.log('   "Edit and proofread this article about AI"\n');
  console.log("3. The Router will analyze and direct to the appropriate agent");
  console.log("=".repeat(80) + "\n");

  console.log("Press Ctrl+C to stop all agents\n");
}, 3000);

// Handle shutdown
const shutdown = () => {
  console.log("\n\n" + "=".repeat(80));
  console.log("🛑 Shutting down all agents...");
  console.log("=".repeat(80) + "\n");

  processes.forEach((proc, index) => {
    if (proc && !proc.killed) {
      console.log(`Stopping ${agents[index].name}...`);
      proc.kill("SIGTERM");
    }
  });

  setTimeout(() => {
    processes.forEach((proc, index) => {
      if (proc && !proc.killed) {
        console.log(`Force killing ${agents[index].name}...`);
        proc.kill("SIGKILL");
      }
    });
    process.exit(0);
  }, 2000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive
process.stdin.resume();
