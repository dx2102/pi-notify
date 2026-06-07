# pi-notify

A small extension for `@earendil-works/pi-coding-agent` that lets an agent send delayed or external follow-up messages to the current session.

It starts a per-session Unix socket and installs a tiny `pi-notify` CLI. Messages sent through the CLI are delivered back into the chat as user follow-up messages prefixed with `[pi-notify]`.

## Usage

Send a message to the current session:

```bash
pi-notify "$PI_SESSION_ID" "time to continue"
```

Schedule a one-time reminder:

```bash
nohup bash -c "sleep 60 && pi-notify $PI_SESSION_ID 'continue the task'" &
echo "PID: $!"
```

Schedule a repeated reminder:

```bash
nohup bash -c "while true; do sleep 300; pi-notify $PI_SESSION_ID 'periodic check'; done" &
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

