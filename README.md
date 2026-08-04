# pi-notify

A small extension for `@earendil-works/pi-coding-agent` that lets an agent send delayed or external follow-up messages to the current session.

It starts a per-session Unix socket and installs a tiny `pi-notify` CLI. Messages sent through the CLI are delivered back into the chat as user follow-up messages prefixed with `[pi-notify]`.

To install `pi-notify`, put the JavaScript file at `~/.pi/agent/extensions/pi-notify/index.js`.

## Usage

Send a message to the current session:

```bash
pi-notify "$PI_SESSION_ID" "time to continue"
```

Schedule a one-time reminder with Python:

```bash
nohup python -u - "$PI_SESSION_ID" <<'PY' &
import subprocess
import sys
import time

time.sleep(60)
subprocess.run(
    ["pi-notify", sys.argv[1], "continue the task"],
    check=True,
)
PY
echo "PID: $!"
```

Schedule a repeated reminder with Python:

```bash
nohup python -u - "$PI_SESSION_ID" <<'PY' &
import subprocess
import sys
import time

while True:
    time.sleep(300)
    subprocess.run(
        ["pi-notify", sys.argv[1], "periodic check"],
        check=False,
    )
PY
echo "PID: $!"
```

List pending notification jobs:

```bash
pgrep -af "$PI_SESSION_ID"
```

Cancel a scheduled job:

```bash
kill <PID>
```

