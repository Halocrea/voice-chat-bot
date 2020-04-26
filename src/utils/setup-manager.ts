import { Message, Client, OverwriteResolvable } from 'discord.js';
import {
  addLocalGuild,
  addLocalGuildId,
  getLocalGuild,
  editCategoryId,
  removeLocalGuild,
  editCreatingChannelId,
  editCommandsChannelId,
  editPrefix,
} from './local-guild-manager';
import { LocalGuild } from '../models/local-guild.model';
import * as dotenv from 'dotenv';

dotenv.config();

export function handleSetup(
  voiceChatBot: Client,
  msg: Message,
  cmd: string,
  args: string
) {
  const localGuild = getLocalGuild(msg.guild!.id);
  const auto = '🤖';
  const manual = '✍️';

  // If we don't have a local guild, it means that the user is trying to set the bot up for the first time
  if (!localGuild) {
    msg.channel
      .send({
        embed: {
          title: 'To set me up',
          description: `Hello 😀\nTo install me on your server, you can do it in two ways:\n\n
          **Automatically** (${auto}), I will create a new category where I can create new channels freely, a new voice channel where the user will go to create his new channel, a text channel where I can manage and post messages and read user commands, and set \`!voice\` as a command prefix. You can still use manual commands to set ids up, in this case you can run \`setup-help\` to get all commands.\n\n
          **Manually** (${manual}), you will have to provide me a category **ID**, a voice channel **ID** where your users will go to create a channel and a text channel **ID** working like a commands room where I can operate freely.`,
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
              autoSetup(voiceChatBot, setupMessage);
            } else {
              manualSetup(voiceChatBot, setupMessage);
            }
          })
          .catch((error) => {
            setupMessage.channel.send(
              `You didn't answer but please don't forget to set me up 😭 Use the command again.`
            );
            console.error(error);
          });
      });
  } else {
    switch (cmd) {
      case 'setup-prefix':
        setupPrefix(localGuild, voiceChatBot, msg, args);
        break;
      case 'setup-category':
        setupCategory(localGuild, voiceChatBot, msg, args);
        break;
      case 'setup-voice':
        setupVoice(localGuild, voiceChatBot, msg, args);
        break;
      case 'setup-commands':
        setupCommands(localGuild, voiceChatBot, msg, args);
        break;
      case 'setup-clear':
        clearSetup(localGuild, voiceChatBot, msg);
        break;
      case 'setup-help':
        helpSetup(voiceChatBot, msg);
        break;
      default:
        msg.channel.send({
          embed: {
            title: `It looks like I'm already set up on your server`,
            description: `If you want to modify my setup, please use the command \`help-setup\` to get the setup commands.`,
            color: 6465260,
            thumbnail: {
              url: voiceChatBot.user?.avatarURL(),
            },
          },
        });
    }
  }
}

async function autoSetup(voiceChatBot: Client, setupMessage: Message) {
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
    addLocalGuild({
      guildId: setupMessage.guild!.id,
      prefix: process.env.CMD_PREFIX!,
      categoryId: category!.id,
      creatingChannelId: voiceChannel!.id,
      commandsChannelId: textChannel!.id,
    });
    sendEmbedSetupCompleted(voiceChatBot, setupMessage);
  } catch (error) {
    setupMessage.channel.send('Error using the auto setup, please try again.');
    console.error(error);
  }
}

function manualSetup(voiceChatBot: Client, setupMessage: Message) {
  addLocalGuildId(setupMessage.guild!.id);
  setupMessage.channel.send({
    embed: {
      title: `Step 1: The Command prefix`,
      description: `Please provide me a command prefix that you will write to use any command. We basically set to \`!voice\` but you can set it to anything you want within 15 characters.\n
      Please use \`!voice setup-prefix <prefix>\` to give me that command prefix.`,
      color: 14323205,
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
      },
    },
  });
}

function setupPrefix(
  localGuild: LocalGuild,
  voiceChatBot: Client,
  msg: Message,
  args: string
) {
  const initialized = !!localGuild.prefix;
  editPrefix(localGuild.guildId, args);
  if (!initialized) {
    msg.channel.send({
      embed: {
        title: `Step 2: The Category`,
        description: `Please provide me a category **ID** so I can operate inside freely.\n
          Keep in mind that I will create all new channels inside this category using an empty voice channel inside that I will ask you the **ID** on the next step.\n
          Basically, I need those permissions on the category:
          - Manage channels
          - Manage permissions
          - View channels
          - Send messages
          - Manage messages
          - Connect
          - Move members\n
          Please use \`<your_prefix> setup-category <category_id>\` to give me that category id.`,
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
  localGuild: LocalGuild,
  voiceChatBot: Client,
  msg: Message,
  args: string
) {
  const initialized = !!localGuild.categoryId;
  editCategoryId(localGuild.guildId, args);
  if (!initialized) {
    msg.channel.send({
      embed: {
        title: `Step 2: The Creating channel`,
        description: `Alright! Now that you have set up the category, I need the voice channel ID living inside the category you previously gave me.\n
          Basically, when someone will join this channel, I will create a new voice channel and move him inside it.\n
          Please use \`<your_prefix> setup-voice <voice_id>\` to give me that creating voice channel id.`,
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
  localGuild: LocalGuild,
  voiceChatBot: Client,
  msg: Message,
  args: string
) {
  const initialized = !!localGuild.creatingChannelId;
  editCreatingChannelId(localGuild.guildId, args);
  if (!initialized) {
    msg.channel.send({
      embed: {
        title: `Step 3: The Commands channel`,
        description: `I'm almost ready!\n
        Now I need you to give me an id of a text channel where you will most likely send all the commands you want to use.\n
        This text channel doesn't need to be in the voice category, but I need to have access to it and to be able to manage and post messages.\n
        Please use \`<your_prefix> setup-commands <commands_id>\` to give the commands channel id.`,
        color: 12118406,
        thumbnail: {
          url: voiceChatBot.user?.avatarURL(),
        },
      },
    });
  } else {
    msg.channel.send('Creating voice channel set! 👍');
  }
}

function setupCommands(
  localGuild: LocalGuild,
  voiceChatBot: Client,
  msg: Message,
  args: string
) {
  const initialized = !!localGuild.commandsChannelId;
  editCommandsChannelId(localGuild.guildId, args);
  if (!initialized) {
    sendEmbedSetupCompleted(voiceChatBot, msg);
  } else {
    msg.channel.send('Commands channel set! 👍');
  }
}

function clearSetup(
  localGuild: LocalGuild,
  voiceChatBot: Client,
  msg: Message
) {
  removeLocalGuild(localGuild.guildId);
  msg.channel.send({
    embed: {
      title: `Setup correctly cleared!`,
      description: `You successfully cleared your server ids! Now, you can use the setup command \`!voice setup\` again or use \`!voice setup-help\` to get setup commands and drive this on your own.`,
      color: 8781568,
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
      },
    },
  });
}

function helpSetup(voiceChatBot: Client, msg: Message) {
  msg.channel.send({
    embed: {
      title: `Setup commands available`,
      description: `Here are all the setup commands you can run as an Administrator:\n
      **setup-prefix <cmd_prefix>**
      It provides me a command prefix that you will write to use any command. Don't forget to use it once you set it!

      **setup-category <category_id>**
      It provides me a category **ID** so I can operate inside freely.\n
      Keep in mind that I will create all new channels inside this category using an empty voice channel inside that I will ask you the **ID** on the next step.\n
      Basically, I need those permissions on the category:
      - Manage channels
      - Manage permissions
      - View channels
      - Send messages
      - Manage messages
      - Connect
      - Move members\n

      **setup-voice <creating_voice_channel_id>**
      It provides me the voice channel ID living inside the voice category.\n
      Basically, when someone will join this channel, I will create a new voice channel and move him inside it.\n

      **setup-commands <commands_channel_id>**
      It provides me an id of a text channel where you will most likely send all the commands you want to use.\n
      This text channel doesn't need to be in the voice category, but I need to have access to it and to be able to manage and post messages.\n

      **setup-clear**
      When you run this command, you delete all the ids I stored for your server. After running it, you can run \`!voice setup\` to set ids up again.
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

function sendEmbedSetupCompleted(voiceChatBot: Client, msg: Message) {
  msg.channel.send({
    embed: {
      title: `I'm correctly set up 💕`,
      description: `Everyone can use me now, feel free to join your creating channel to create a new channel and start chatting 💬 Have a good time guys !\n
        If you need to modify my setup, use the command \`setup-help\` to get the commands that will help you update my setup.\n\n
        P.S: Please, be careful about my permissions if you want to modify them.`,
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
