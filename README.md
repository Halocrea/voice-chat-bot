# Welcome to voice-chat-bot 👋

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000)
[![Discord](https://img.shields.io/badge/Discord-support-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/FxtBV5x)
[![Twitter: HaloCreation](https://img.shields.io/twitter/follow/HaloCreation.svg?style=social)](https://twitter.com/HaloCreation)

> A Discord bot that lets your community manage their voice channels themselves

## About

This bot is here to let your community manage their voice channels on their own.<br/>
Basically, by joining a specified permanent voice channel living inside a specified voice category, the bot will generate for the user a new voice channel inside the category and let him manage it by giving a full set of commands, and this voice channel will be deleted once empty.

A server can host **as many sectors as it wants**: each sector is a category paired with its own trigger channel, so you can run a « Gaming » one next to a « Chat » one. Members' preferences (their channel name and user limit) are remembered per sector.

### Setup

- If you never set up a Discord bot before, please follow the instructions over [here](https://discordapp.com/developers/docs/intro).
- If you don't want to host your own version of the bot but consume an existing instance of it, you can use the following invite link: https://discord.com/api/oauth2/authorize?client_id=700399848666562611&permissions=286262288&scope=bot+applications.commands
- **If you host your own instance**, its invite link must carry the `applications.commands` scope too, otherwise the slash commands never show up on the server.
- Once that is done, invite the bot to your server, and run `/voice-setup auto` to let it create everything it needs. Please refer to [this part](#admin-commands-list) to get the full list of setup commands.

### Permissions required

In order to work properly, this bot will need this set of permissions globally and on the voice category:

- Manage Roles
- Manage Channels
- View Channels
- Connect
- Move Members

That is the permission integer `286262288`. Since every answer is now ephemeral, the bot no longer needs _Send Messages_, _Manage Messages_ nor _Read Message History_.

**Careful:** Discord refuses to let a bot _grant_ a permission it doesn't hold itself, so `/voice-setup auto` checks all five before touching anything and names the ones it is missing.

_Manage Roles_ is only ever needed **server-wide**. Discord will not let a non-administrator bot pin that particular permission onto a category. Handing out the right to hand out rights is a deliberate anti-escalation guard. That is expected, and no reason to grant the bot Administrator.

## Install

### Create `.env` file and fill it with your information

```sh
cp sample.env .env
```

`TOKEN` and `CLIENT_ID` come from your application on the [Discord developer portal](https://discord.com/developers/applications).
Setting `DEV_GUILD_ID` deploys the commands to that single server, where they appear instantly — leave it empty to deploy globally, which can take up to an hour.

This bot requires **no privileged intent**: everything goes through slash commands, so `MESSAGE CONTENT` can stay off.

### Supervision

The bot logs through [winston](https://github.com/winstonjs/winston), on the console only. Process managers such as pm2, systemd or Docker already capture stdout and rotate it, so persisting logs is left to whichever one you run — writing them a second time from inside the application would only duplicate the work, and wear out flash storage that much faster on small hosts.

Two optional variables turn on the rest:

- **`ALERT_WEBHOOK_URL`** — errors are posted to a Discord webhook. A webhook rather than the bot's own connection, because the connection shares the fate of whatever broke it: this still gets through with the gateway down or the token rejected. Identical errors are reported once per five minutes and then summarised, and a hard ceiling keeps a storm from flooding the channel.
- **`HEARTBEAT_URL`** — the bot pings an external dead man's switch every few minutes, and only while it is actually connected to Discord. It is the **silence** that alerts you, which is the only way to hear about a bot that died: a dead process sends nothing. It pushes rather than being polled, so it works from behind NAT with no inbound port to open — which matters if you self-host.

Permission errors are logged as warnings and deliberately never alerted: they mean a server administrator has misconfigured their own server, they have already been told, and there is nothing for you to do. An alert channel people learn to ignore is worse than no alert channel at all.

### Deploy the slash commands

Commands have to be registered with Discord once, and again whenever they change:

```sh
npm run build
npm run deploy
```

### What a host needs

Anywhere Node runs will do, provided three things:

- **Node 22 or newer.** `better-sqlite3` does not support anything older.
- **A process that stays up.** The bot holds an open websocket to Discord; any host that sleeps idle processes, or restarts them on request only, will leave it deaf.
- **A filesystem that survives restarts**, for the five SQLite files in `saves/`. On a host with an ephemeral disk, every restart comes back to an empty configuration and every server has to be set up again.

No inbound port and no public address are needed — every connection the bot makes is outbound. Resource use is modest: a small VPS or a Raspberry Pi handles it comfortably.

### Install and run with Docker

```sh
docker build -t voice-chat-bot .
docker run -d \
  --name voice-chat-bot \
  --env-file .env \
  -v /absolute/host/path/to/saves:/app/saves \
  --restart unless-stopped \
  voice-chat-bot
```

`--env-file` is what hands the container its token; without it the bot starts with an empty configuration and immediately fails to log in. The volume is what makes the databases outlive the container.

`unless-stopped` rather than `always`, so a container you deliberately stop stays stopped across a reboot.

### Install with npm

#### Setup

```sh
npm install
```

#### Run development

```sh
npm run dev
```

#### Build

```sh
npm run build
```

#### Run build

```sh
npm start
```

## Commands list

Every answer the bot gives is **ephemeral**: only the person who ran the command sees it, so nothing clutters your channels.

### Admin commands list

**Notice:** You must be an administrator of your server to run those commands. They'll help set the bot up on your server properly.<br/>
Here are all the commands you can use:

- `/voice-setup auto [name]`: Create a whole new sector, category and trigger channel included. Run it again to add another one.
- `/voice-setup add <category> <channel>`: Turn an existing category and one of its voice channels into a sector. The channel has to live inside the category, and a category can only host one sector.
- `/voice-setup list`: List every sector the bot manages on your server.
- `/voice-setup remove <category>`: Stop managing that sector. The channels already there are left untouched.
- `/voice-setup clear`: Forget every sector on your server.

**Notice:** These commands below will help you handle moderation roles. A role added to the moderation can bypass voice channels ownership and can't be rejected from a channel (this is naturally the case for the administrators).

- `/voice-mod add <role>`: Add a role allowed to moderate the bot
- `/voice-mod list`: List all the roles allowed to moderate the bot
- `/voice-mod remove <role>`: Remove a role no longer allowed to moderate the bot

### User commands list

**Notice:** You must own the voice channel you're currently in to perform most of these actions (except for `/voice claim`).<br/>
Here are all the commands you can use:

- `/voice name <name>`: Rename your channel. The bot remembers it for your next channel in that sector.
- `/voice lock`: Lock your channel; nobody can join you unless you explicitely allow them to do so by using the `/voice permit` command (see hereafter). If the bot remembers who you allowed in your previous channel, it offers to restore those permissions.
- `/voice permit <target>`: Allow the given member or role to join your locked channel.
- `/voice unlock`: Open your locked channel to everyone.
- `/voice reject <member>`: Kick a member out of your channel.
- `/voice claim`: Request ownership of the voice channel you're currently into. This action can be performed only if the channel's previous owner left.
- `/voice limit <count>`: Set a user limit to your channel (Here 0 means **unlimited**).
- `/voice bitrate <bitrate>`: Set the channel's bitrate, in bits per second.

There is no `help` command anymore: Discord shows every command and its description as you type `/`.

## Author

👤 **Grenadator**

- Twitter: [@\_Grenadator](https://twitter.com/_Grenadator)
- Github: [@Grenadator](https://github.com/Grenadator)

## Quick Thanks

- Thanks [@Tepec Fett](https://twitter.com/tepecfett) for helping me a lot on developing this bot and for the translations
- Thanks Bendak for all the features ideas, and both of you for taking the time to test the bot
- Thanks [@Aronild](https://twitter.com/AroniId) for your opinion and your wonderful gif on help commands

You guys are the best 😎

## Support

Need a hand, hit a bug, or want to suggest a feature? Come talk to us on our
Discord server, which hosts a support forum for all of our bots:

**https://discord.gg/FxtBV5x**

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/Halocrea/voice-chat-bot/issues).

## Show your support

Give a ⭐️ if this project helped you!

---

_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
