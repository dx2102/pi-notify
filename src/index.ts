import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createServer, type Server } from "node:net";
import { chmodSync, existsSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";

let server: Server | null = null;
let sockPath: string | null = null;
let sessionId: string | null = null;

const BIN_DIR = join(homedir(), ".local", "bin");
const BIN_PATH = join(BIN_DIR, "pi-notify");

// pi-notify CLI script content (plain JS, works with bun or node)
const CLI_SCRIPT = `#!/usr/bin/env bun
import net from "net";
import os from "os";
import path from "path";

const sid = process.env.PI_SESSION_ID;
if (!sid) { process.stderr.write("pi-notify: PI_SESSION_ID not set\\n"); process.exit(1); }
const msg = process.argv.slice(2).join(" ");
if (!msg) { process.stderr.write("pi-notify: usage: pi-notify <message>\\n"); process.exit(1); }

const sock = net.connect(path.join(os.tmpdir(), \`pi-notify-\${sid}.sock\`));
sock.on("connect", () => { sock.write(msg + "\\n"); sock.end(); });
sock.on("error", (e) => { process.stderr.write(\`pi-notify: \${e.message}\\n\`); process.exit(1); });
`;

function installCli() {
  if (existsSync(BIN_PATH)) return;
  try {
    mkdirSync(BIN_DIR, { recursive: true });
    writeFileSync(BIN_PATH, CLI_SCRIPT, { mode: 0o755 });
  } catch (e) {
    // non-fatal: LLM can still use full path
  }
}

function startSocket(api: ExtensionAPI) {
  if (!sessionId) return;
  sockPath = join(tmpdir(), `pi-notify-${sessionId}.sock`);
  if (existsSync(sockPath)) unlinkSync(sockPath);

  server = createServer((conn) => {
    let buf = "";
    conn.on("data", (data) => {
      buf += data.toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        const msg = line.trim();
        if (msg) {
          api.sendUserMessage(`[pi-notify]\n\n${msg}`, { deliverAs: "followUp" });
        }
      }
    });
    conn.on("error", () => {});
  });

  server.listen(sockPath, () => {
    if (sockPath) chmodSync(sockPath, 0o600);
  });
}

function stopSocket() {
  server?.close();
  server = null;
  if (sockPath && existsSync(sockPath)) {
    unlinkSync(sockPath);
    sockPath = null;
  }
}

export default function (pi: ExtensionAPI) {
  installCli();

  pi.on("session_start", async (_event, ctx) => {
    sessionId = ctx.sessionManager.getSessionId();
    startSocket(pi);
  });

  pi.on("session_shutdown", async () => {
    stopSocket();
  });

  pi.on("before_agent_start", async (_event, _ctx) => {
    if (!sessionId) return {};
    return {
      systemPrompt: `## pi-notify

You can send yourself a delayed message using \`pi-notify\`:

  nohup bash -c "sleep <seconds> && pi-notify '<message>'" &

Your session ID is already set as \$PI_SESSION_ID in your bash environment.
List pending notifications: ps aux | grep "sleep.*pi-notify"
Cancel one: kill <PID>`,
    };
  });

  // Inject PI_SESSION_ID into every LLM bash call so subprocesses inherit it
  pi.on("tool_call", async (event) => {
    if (event.toolName === "bash" && sessionId) {
      event.input.command = `export PI_SESSION_ID=${sessionId}\n${event.input.command}`;
    }
  });
}
