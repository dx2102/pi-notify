# pi-notify

A small extension for `@earendil-works/pi-coding-agent` that lets an agent send delayed or external follow-up messages to the current session.

It starts a per-session Unix socket and installs a tiny `pi-notify` CLI. Messages sent through the CLI are delivered back into the chat as user follow-up messages prefixed with `[pi-notify]`.

## What it does

- Creates a Unix socket at `/tmp/pi-notify-<session-id>.sock`
- Installs `pi-notify` into `~/.local/bin/pi-notify`
- Injects `PI_SESSION_ID` into bash tool calls
- Lets the agent schedule one-shot or repeated reminders using shell commands

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

## Notes

If the agent is busy running tools, notifications are queued and delivered after the current turn finishes. The notification text should be a trigger/reminder for the agent, not a final response to the user.
