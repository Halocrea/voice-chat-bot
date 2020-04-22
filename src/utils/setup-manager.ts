import { Message, Client, OverwriteResolvable } from 'discord.js';
import { addLocalGuild } from './local-guild-manager';

export function handleSetup(voiceChatBot: Client, msg: Message) {
  const auto = '🤖';
  const manual = '✍️';
  msg.channel
    .send({
      embed: {
        title: 'To set me up',
        description: `Hello 😀\nTo install me on your server, you can do it in two ways:\n\n
        **Automatically** (${auto}), I will create a new category where I can create new channels freely, a new voice channel where the user will go to create his new channel, and a text channel where I can manage and post messages and read user commands.\n\n
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
            manualSetup();
          }
        })
        .catch((error) => {
          setupMessage.channel.send(
            "You didn't answer but please don't forget to set me up 😭 Use the command again."
          );
          console.error(error);
        });
    });
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
      categoryId: category!.id,
      creatingChannelId: voiceChannel!.id,
      commandsChannelId: textChannel!.id,
    });
    setupMessage.channel.send({
      embed: {
        title: `I'm correctly set up 💕`,
        description: `Everyone can use me now, feel free to join your creating channel to create a new channel and start chatting 💬 Have a good time guys !
        \n\nP.S: Please, be careful about my permissions if you want to modify them.`,
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
  } catch (error) {
    setupMessage.channel.send('Error using the auto setup, please try again.');
    console.error(error);
  }
}

function manualSetup() {
  console.log('Oui.');
}
