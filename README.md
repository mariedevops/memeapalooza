# Meme-A-Palooza Bot Server

Twitch chat bot + WebSocket bridge for the Meme-A-Palooza slot machine.

## Environment variables (set these in Railway)

| Variable | Description | Example |
|---|---|---|
| `TWITCH_USERNAME` | Your Twitch username | `Foundamilliononthestreet` |
| `TWITCH_OAUTH` | OAuth token with `oauth:` prefix | `oauth:ja61z1ii58201x...` |
| `TWITCH_CHANNEL` | Channel to listen to (usually same as username) | `Foundamilliononthestreet` |
| `PORT` | Auto-set by Railway | (leave blank) |

## Commands supported in chat

| Command | Effect |
|---|---|
| `!spin` | Spin with 10 coin default bet |
| `!bet 50` | Spin with 50 coin bet |
| `!bet 100 doge` | Spin with 100 coin bet (doge hint) |
| `!stonks` | Trigger stonks animation |
| `!balance` | Check your coin balance |
