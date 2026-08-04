import { createServer } from "node:net";
import { chmodSync, existsSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

let server = null;
let sockPath = null;
let sessionId = null;

const BIN_DIR = join(homedir(), ".local", "bin");
const BIN_PATH = join(BIN_DIR, "pi-notify");

// pi-notify CLI script content (plain JS, works with bun or node)
const CLI_SCRIPT = `#!/usr/bin/env bun
import net from "net";
import os from "os";
import path from "path";

const [sid, msg] = [process.argv[2], process.argv[3]];
if (!sid || !msg || process.argv.length !== 4) {
  process.stderr.write("usage: pi-notify <session-id> <message>\\n");
  process.exit(1);
}

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

function startSocket(api) {
  if (!sessionId) return;
  sockPath = join(tmpdir(), `pi-notify-${sessionId}.sock`);
  if (existsSync(sockPath)) unlinkSync(sockPath);

  server = createServer((conn) => {
    let buf = "";
    conn.on("data", (data) => {
      buf += data.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
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

export default function (pi) {
  installCli();

  pi.on("session_start", async (_event, ctx) => {
    sessionId = ctx.sessionManager.getSessionId();
    startSocket(pi);
  });

  pi.on("session_shutdown", async () => {
    stopSocket();
  });

  pi.on("before_agent_start", async (event) => {
    if (!sessionId) return {};
    return {
      systemPrompt: `${event.systemPrompt}\n\n## pi-notify

pi-notify 让 agent 可以在无人值守的情况下自我唤醒、执行定时任务。消息会加上 [pi-notify] 前缀，以用户消息的身份发入聊天。
用途包括：预设一次性任务、周期性循环执行、外部脚本回调、agent 间通信。

注意：agent 执行工具期间，新消息会排队等待，而不会打断一轮对话，因此实际到达可能比预期晚。
你在 pi-notify 里填写的内容，是发给自己的触发信号或任务提醒，而不是回复给用户的内容——收到后再由你生成实际响应。

用法：pi-notify <session-id> "<消息>"
你的 session ID 已通过 $PI_SESSION_ID 注入到 bash 环境中。

### 命令指南

**启动**（启动后必须立即 echo $! 记录 PID）

一次性（60 秒后触发一次）：

nohup python -u - "$PI_SESSION_ID" <<'PY' &
import subprocess
import sys
import time

time.sleep(60)
subprocess.run(
    ["pi-notify", sys.argv[1], "推进项目"],
    check=True,
)
PY
echo "PID: $!"

周期性（每隔 300 秒重复，直到手动取消）：

nohup python -u - "$PI_SESSION_ID" <<'PY' &
import subprocess
import sys
import time

while True:
    time.sleep(300)
    subprocess.run(
        ["pi-notify", sys.argv[1], "推进项目"],
        check=False,
    )
PY
echo "PID: $!"

**查看本 session 的通知进程**

pgrep -af "$PI_SESSION_ID"

**取消**

kill <启动时记录的 PID>    # 用 PID 精确取消，不要用 pkill`,
    };
  });
}
