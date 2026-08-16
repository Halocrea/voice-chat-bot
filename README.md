# Welcome to voice-chat-bot 👋

![Version](https://img.shields.io/badge/version-0.3.0-blue.svg?cacheSeconds=2592000)
[![Discord](https://img.shields.io/badge/Discord-support-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/FxtBV5x)
[![Twitter: HaloCreation](https://img.shields.io/twitter/follow/HaloCreation.svg?style=social)](https://twitter.com/HaloCreation)

> A Discord bot that lets your community manage their voice channels themselves

## About

This bot is here to let your community manage their voice channels on their own.<br/>
Basically, by joining a specified permanent voice channel living inside a specified voice category, the bot will generate for the user a new voice channel inside the category and let him manage it by giving a full set of commands, and this voice channel will be deleted once empty.

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

**Careful:** Discord refuses to let a bot _grant_ a permission it doesn't hold itself. The bot writes those very permissions into the overwrites of the category it creates, so missing a single one makes `/voice-setup auto` fail with a bare `Missing Permissions`. Running the command tells you exactly which ones are missing.

## Install

### Create `.env` file and fill it with your information

```sh
cp sample.env .env
```

`TOKEN` and `CLIENT_ID` come from your application on the [Discord developer portal](https://discord.com/developers/applications).
Setting `DEV_GUILD_ID` deploys the commands to that single server, where they appear instantly — leave it empty to deploy globally, which can take up to an hour.

This bot requires **no privileged intent**: everything goes through slash commands, so `MESSAGE CONTENT` can stay off.

### Deploy the slash commands

Commands have to be registered with Discord once, and again whenever they change:

```sh
npm run build
npm run deploy
```

### Install and run with Docker

```sh
docker build -t voice-chat-bot .
docker run -d -v /absolute/host/path/to/saves/:app/saves --restart=always --name=voice-chat-bot voice-chat-bot
```

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

- `/voice-setup auto`: Let the bot create the category and the voice channel it needs, then save the whole configuration.
- `/voice-setup category <category>`: Pick the category the bot will operate in (create and manage voice channels).
- `/voice-setup voice <channel>`: Pick the permanent voice channel. Whenever someone joins it, the bot generates another voice channel and moves them inside it.
- `/voice-setup show`: Show the current configuration.
- `/voice-setup clear`: Delete everything the bot stored for your server.

**Notice:** These commands below will help you handle moderation roles. A role added to the moderation can bypass voice channels ownership and can't be rejected from a channel (this is naturally the case for the administrators).

- `/voice-mod add <role>`: Add a role allowed to moderate the bot
- `/voice-mod list`: List all the roles allowed to moderate the bot
- `/voice-mod remove <role>`: Remove a role no longer allowed to moderate the bot

### User commands list

**Notice:** You must own the voice channel you're currently in to perform most of these actions (except for `/voice claim`).<br/>
Here are all the commands you can use:

- `/voice name <name>`: Rename your channel.
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
