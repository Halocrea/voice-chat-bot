import { Message, Client, OverwriteResolvable } from 'discord.js';
import {
  editCategoryId,
  editCreatingChannelId,
  editCommandsChannelId,
  editPrefix,
  GuildSetup,
  addGuildSetup,
  addGuildSetupId,
  deleteGuildSetup,
} from '../models/GuildSetup';
import * as dotenv from 'dotenv';

dotenv.config();

export function handleSetup(
  voiceChatBot: Client,
  guildSetup: GuildSetup,
  msg: Message,
  cmdPrefix: string,
  cmd: string,
  args: string
) {
  const auto = '🤖';
  const manual = '⚙️';

  // If we don't have a local guild, it means that the user is trying to set the bot up for the first time
  if (!guildSetup) {
    msg.channel
      .send({
        embed: {
          title: 'To set me up',
          description: `Hello 😀\nBefore I can do things on your server, I require a bit of configuration; there are two ways to do so:\n\n
          **Automatically** (${auto}), I'll create a new category into which I'm able to manage new voice channels on the fly. Then, I'll add into this category a permanent voice channel that'll be used by members to generate their own voice channels. I'll also add a text channel to listen to members' commands and reply to them. If you'd like me to use existing channels and category instead of creating new ones, run \`${cmdPrefix} setup-help\` to get all commands.\n\n
          **Manually** (${manual}), I'll ask you for a category **ID** and a voice channel **ID** where your users will go to create a channel, and a text channel **ID** working like a commands room where I can listen to your members' requests and reply to them freely.`,
          color: 6465260,
          thumbnail: {
            url: voiceChatBot.user?.avatarURL(),
          },
        },
      })
      .then((setupMessage) => {
        setupMessage.react(auto);
        setupMessage.react(manual);
        setupMessage
          .awaitReactions(
            (reaction, user) =>
              [auto, manual].includes(reaction.emoji.name) &&
              user.id === msg.author.id,
            {
              max: 1,
              time: 2 * 60000,
              errors: ['time'],
            }
          )
          .then((collected) => {
            const reaction = collected.first();
            if (reaction?.emoji.name === auto) {
              autoSetup(voiceChatBot, cmdPrefix, setupMessage);
            } else {
              manualSetup(voiceChatBot, cmdPrefix, setupMessage);
            }
          })
          .catch((error) => {
            setupMessage.channel.send(
              `You didn't answer in time, but please don't forget to set me up 😭 You'll have to re-use the command again.`
            );
            console.error(error);
          });
      });
  } else {
    switch (cmd) {
      case 'setup-prefix':
        setupPrefix(guildSetup, voiceChatBot, cmdPrefix, msg, args);
        break;
      case 'setup-category':
        setupCategory(guildSetup, voiceChatBot, cmdPrefix, msg, args);
        break;
      case 'setup-voice':
        setupVoice(guildSetup, voiceChatBot, cmdPrefix, msg, args);
        break;
      case 'setup-commands':
        setupCommands(guildSetup, voiceChatBot, cmdPrefix, msg, args);
        break;
      case 'setup-clear':
        clearSetup(guildSetup, voiceChatBot, cmdPrefix, msg);
        break;
      case 'setup-help':
        helpSetup(voiceChatBot, cmdPrefix, msg);
        break;
      default:
        msg.channel.send({
          embed: {
            title: `It looks like I'm already set up on your server`,
            description: `If you want to edit my setup, please use the command \`${cmdPrefix} help-setup\` to get the setup commands.`,
            color: 6465260,
            thumbnail: {
              url: voiceChatBot.user?.avatarURL(),
            },
          },
        });
    }
  }
}

async function autoSetup(
  voiceChatBot: Client,
  cmdPrefix: string,
  setupMessage: Message
) {
  const permissions: OverwriteResolvable[] = [
    {
      id: voiceChatBot.user!.id,
      allow: [
        'MANAGE_CHANNELS',
        'MANAGE_ROLES',
        'VIEW_CHANNEL',
        'CONNECT',
        'MOVE_MEMBERS',
      ],
    },
  ];
  try {
    const category = await setupMessage.guild?.channels.create(
      'Voice channels',
      {
        type: 'category',
        permissionOverwrites: permissions,
      }
    );
    const voiceChannel = await setupMessage.guild?.channels.create(
      'Create a channel',
      { type: 'voice', parent: category?.id, permissionOverwrites: permissions }
    );
    const textChannel = await setupMessage.guild?.channels.create('Commands', {
      type: 'text',
      parent: category?.id,
      permissionOverwrites: permissions,
    });
    addGuildSetup({
      guildId: setupMessage.guild!.id,
      prefix: process.env.CMD_PREFIX!,
      categoryId: category!.id,
      creatingChannelId: voiceChannel!.id,
      commandsChannelId: textChannel!.id,
    });
    sendEmbedSetupCompleted(voiceChatBot, cmdPrefix, setupMessage);
  } catch (error) {
    setupMessage.channel.send('Error using the auto setup, please try again.');
    console.error(error);
  }
}

function manualSetup(
  voiceChatBot: Client,
  cmdPrefix: string,
  setupMessage: Message
) {
  addGuildSetupId(setupMessage.guild!.id);
  setupMessage.channel.send({
    embed: {
      title: `Step 1: The Command prefix`,
      description: `Please indicate a command prefix that I'll watch to know when someone is requesting something from me. By default, my command prefix is \` ${process.env.CMD_PREFIX}\`, but you can set it to anything you want within 15 characters.\n
      Please use \`${cmdPrefix} setup-prefix <prefix>\` to change my command prefix.`,
      color: 14323205,
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
      },
    },
  });
}

function setupPrefix(
  guildSetup: GuildSetup,
  voiceChatBot: Client,
  cmdPrefix: string,
  msg: Message,
  args: string
) {
  const initialized = !!guildSetup.prefix;
  editPrefix(guildSetup.guildId, args);
  if (!initialized) {
    msg.channel.send({
      embed: {
        title: `Step 2: The Category`,
        description: `Please provide me a category **ID** so I can operate inside freely.\n
          Keep in mind that I will create and manage channels inside this category. I will also require a permanent voice channel, that I will ask you the **ID** on the next step.\n
          I need the following permissions on the category:
          - Manage channels
          - Manage permissions
          - View channels
          - Send messages
          - Manage messages
          - Connect
          - Move members\n
          Please use \`${cmdPrefix} setup-category <category_id>\` to give me that category id.`,
        color: 15968821,
        thumbnail: {
          url: voiceChatBot.user?.avatarURL(),
        },
      },
    });
  } else {
    msg.channel.send('Command prefix successfully set! 👍');
  }
}

function setupCategory(
  guildSetup: GuildSetup,
  voiceChatBot: Client,
  cmdPrefix: string,
  msg: Message,
  args: string
) {
  const initialized = !!guildSetup.categoryId;
  editCategoryId(guildSetup.guildId, args);
  if (!initialized) {
    msg.channel.send({
      embed: {
        title: `Step 3: The permanent voice channel`,
        description: `Alright! Now that you have set up the category, I need a permanent voice channel living inside the category.\n
          Whenever someone joins this channel, I will generate another voice channel and move them inside it.\n
          Please use \`${cmdPrefix} setup-voice <voice_id>\` to let me know the ID of that voice channel.`,
        color: 16312092,
        thumbnail: {
          url: voiceChatBot.user?.avatarURL(),
        },
      },
    });
  } else {
    msg.channel.send('Category successfully set! 👍');
  }
}

function setupVoice(
  guildSetup: GuildSetup,
  voiceChatBot: Client,
  cmdPrefix: string,
  msg: Message,
  args: string
) {
  const initialized = !!guildSetup.creatingChannelId;
  editCreatingChannelId(guildSetup.guildId, args);
  if (!initialized) {
    msg.channel.send({
      embed: {
        title: `Step 4: The Commands channel`,
        description: `I'm almost ready!\n
        Now I need you to give me the ID of a text channel into which I will interact with users; they'll use my commands there, and I'll reply to them there as well.\n
        This text channel doesn't need to be into the voice category, but I must be able to read it and to send messages into it.\n
        Please use \`${cmdPrefix} setup-commands <commands_id>\` to let me know the ID of this commands channel.`,
        color: 12118406,
        thumbnail: {
          url: voiceChatBot.user?.avatarURL(),
        },
      },
    });
  } else {
    msg.channel.send('Permanent voice channel set! 👍');
  }
}

function setupCommands(
  guildSetup: GuildSetup,
  voiceChatBot: Client,
  cmdPrefix: string,
  msg: Message,
  args: string
) {
  const initialized = !!guildSetup.commandsChannelId;
  editCommandsChannelId(guildSetup.guildId, args);
  if (!initialized) {
    sendEmbedSetupCompleted(voiceChatBot, cmdPrefix, msg);
  } else {
    msg.channel.send('Commands channel set! 👍');
  }
}

function clearSetup(
  guildSetup: GuildSetup,
  voiceChatBot: Client,
  cmdPrefix: string,
  msg: Message
) {
  deleteGuildSetup(guildSetup.guildId);
  msg.channel.send({
    embed: {
      title: `Setup correctly cleared!`,
      description: `You successfully cleared my configuration! Now, you can use the setup command \`${cmdPrefix} setup\` again or use \`${cmdPrefix} setup-help\` to get setup commands and drive this on your own.`,
      color: 8781568,
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
      },
    },
  });
}

function helpSetup(voiceChatBot: Client, cmdPrefix: string, msg: Message) {
  msg.channel.send({
    embed: {
      title: `Available Setup Commands`,
      description: `Here are all the setup commands you can run as an Administrator:\n
      **${cmdPrefix} setup-prefix <cmd_prefix>**
      Use this to change my command prefix. By default, you can call me by using ${process.env.CMD_PREFIX}, but this command lets you change it.

      **${cmdPrefix} setup-category <category_id>**
      Use this to give me the category **ID** into which I will operate (create and manage voice channels).\n
      Keep in mind that I will create and manage channels inside this category. I will also require a permanent voice channel, that I will ask you the **ID** on the next step.\n
      I need the following permissions on the category:
      - Manage channels
      - Manage permissions
      - View channels
      - Send messages
      - Manage messages
      - Connect
      - Move members\n

      **${cmdPrefix} setup-voice <creating_voice_channel_id>**
      Use this to let me know the permanent voice channel living inside the voice category.\n
      Whenever someone joins this channel, I will generate another voice channel and move them inside it.\n

      **${cmdPrefix} setup-commands <commands_channel_id>**
      Use this to let me know the text channel into which I will interact with users; they'll use my commands there, and I'll reply to them there as well.\n
      This text channel doesn't need to be into the voice category, but I must be able to read it and to send messages into it.\n

      **${cmdPrefix} setup-clear**
      When you run this command, you delete all the IDs I stored for your server. After running it, you can run \`${cmdPrefix} setup\` to set IDs up again.
      `,
      image: {
        url:
          'https://cdn.discordapp.com/attachments/681483039032999962/703017371215986688/LdB8ROR.gif',
      },
      color: 6465260,
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
      },
      timestamp: new Date(),
      author: {
        name: voiceChatBot.user?.username,
        icon_url: voiceChatBot.user?.avatarURL(),
      },
    },
  });
}

function sendEmbedSetupCompleted(
  voiceChatBot: Client,
  cmdPrefix: string,
  msg: Message
) {
  msg.channel.send({
    embed: {
      title: `I'm correctly configured 💕`,
      description: `Everyone can use me now, feel free to join the permanent voice channel to get your own channel and start chatting 💬 Have a good time buddy!\n
        If you need to edit my setup, use the command \`${cmdPrefix} setup-help\` to get the list of commands to change things up.\n\n
        P.S: Please, be careful about my permissions if you want to edit them.`,
      color: 8781568,
      image: {
        url: 'https://i.imgur.com/z6PuA75.gif',
      },
      timestamp: new Date(),
      author: {
        name: voiceChatBot.user?.username,
        icon_url: voiceChatBot.user?.avatarURL(),
      },
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
      },
    },
  });
}
