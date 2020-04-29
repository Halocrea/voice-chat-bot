# Welcome to voice-chat-bot 👋

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg?cacheSeconds=2592000)
[![Twitter: _Grenadator](https://img.shields.io/twitter/follow/_Grenadator.svg?style=social)](https://twitter.com/_Grenadator)

> A Discord bot that lets your community manage their voice channels themselves

## Install

### Create `.env` file and fill it with your information

```sh
cp sample.env .env
```

### Setup

```sh
npm install
```

### Run development

```sh
npm run dev
```

## Usage

### Build

```sh
npm run build
```

### Run build

```sh
npm start
```

## About

This bot is here to let your community manage their voice channels on their own.<br/>
Basically, by joining a specified permanent voice channel living inside a specified voice category, the bot will generate for the user a new voice channel inside the category and let him manage it by giving a full set of commands, and this voice channel will be deleted once empty.

### Permissions required

In order to work properly, this bot will need this set of permissions globally and on the voice category:

- Manage Roles
- Manage Channels
- View Channels
- Send Messages
- Manage Messages
- Read Message History
- Connect
- Move Members

## Commands list

### Admin commands list

**Notice:** You must be an administrator of your server to run those commands. They'll help set the bot up on your server properly.<br/>
Here are all the commands you can use:

- `!voice setup`: Set the bot up on your server.
- `!voice setup-help`: Get setup commands list on Discord.
- `!voice setup-prefix <cmd_prefix>`: Replace `!voice` with your own prefix.
- `!voice setup-category <category_id>`: Use this to give the bot the category **ID** into which he will operate (create and manage voice channels).<br/>
  Keep in mind that he will create and manage channels inside this category. The bot will also require a permanent voice channel, that you can set the **ID** up using the following command.
- `!voice setup-voice <creating_voice_channel_id>`: Use this to let the bot know the permanent voice channel living inside the voice category. Whenever someone joins this channel, the bot will generate another voice channel and move them inside it.
- `!voice setup-commands <commands_channel_id>`: Use this to let the bot know the text channel into which he will interact with users; they'll use its commands there, and he'll reply to them there as well. This text channel doesn't need to be into the voice category, but the bot must be able to read it and to send messages into it.
- `!voice setup-clear`: When you run this command, you delete all the IDs the bot stored for your server. After running it, you can run `!voice setup` to set IDs up again.

### User commands list

**Notice:** You must own the voice channel you're currently in to perform most of these actions (except for `!voice claim`).<br/>
Here are all the commands you can use:

- `!voice help`: Get commands list on Discord.
- `!voice lock`: Lock your channel; nobody can join you unless you explicitely allow them to do so by using the `!voice permit` command (see hereafter).
- `!voice permit <@someone/@role/username>`: Allow the given user or role to join your locked channel.
- `!voice unlock`: Open your locked channel to everyone.
- `!voice reject <@someone/username>`: Kick a user out of your channel.
- `!voice claim`: Request ownership of the voice channel you're currently into. This action can be performed only if the channel's previous owner left.
- `!voice limit <0 <= number <= 99>`: Set a user limit to your channel (Here 0 means **unlimited**).
- `!voice bitrate <number>`: Set the channel's bitrate.

## Author

👤 **Grenadator**

- Twitter: [@\_Grenadator](https://twitter.com/_Grenadator)
- Github: [@Grenadator](https://github.com/Grenadator)

## Quick Thanks

- Thanks [@Tepec Fett](https://twitter.com/tepecfett) for helping me a lot on developing this bot and for the translations
- Thanks Bendak for all the features ideas, and both of you for taking the time to test the bot
- Thanks [@Aronild](https://twitter.com/AroniId) for your opinion and your wonderful gif on help commands

You guys are the best 😎

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

Feel free to check [issues page](https://github.com/Grenadator/voice-chat-bot/issues).

## Show your support

Give a ⭐️ if this project helped you!

---

_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
