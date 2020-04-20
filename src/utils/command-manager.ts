import { Message, VoiceChannel, Client } from 'discord.js';
import { editOwning } from './owning-manager';

export async function renameChannel(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  try {
    await channel.edit(
      { name: args },
      `Voice Bot: Asked by his owner (${msg.author.username})`
    );
    msg.channel.send('The channel has been correctly renamed!');
  } catch (error) {
    console.error(error);
  }
}

export async function lockChannel(
  msg: Message,
  channel: VoiceChannel,
  userId: string
) {
  try {
    // await channel.overwritePermissions(
    //   [
    //     {
    //       id: msg.guild?.id!,
    //       deny: ['CONNECT'],
    //     },
    //     {
    //       id: userId,
    //       allow: ['CONNECT'],
    //     },
    //     {
    //       id: msg.client.user?.id!,
    //       allow: ['MANAGE_CHANNELS'],
    //     },
    //   ],
    //   `Voice Bot: The owner (${msg.author.username}) wants to lock the channel`
    // );
    await channel.updateOverwrite(
      msg.guild?.id!,
      { CONNECT: false },
      `Voice Bot: The owner (${msg.author.username}) wants to lock the channel`
    );
    await channel.updateOverwrite(userId, { CONNECT: true });
    msg.channel.send('The channel is now locked.');
  } catch (error) {
    console.error(error);
  }
}

export async function unlockChannel(msg: Message, channel: VoiceChannel) {
  try {
    await channel.lockPermissions();
    msg.channel.send('The channel is no longer locked.');
  } catch (error) {
    console.error(error);
  }
}

export async function permitUser(msg: Message, channel: VoiceChannel) {
  try {
    const allowed = msg.mentions.members?.first();
    if (allowed) {
      await channel.updateOverwrite(
        allowed,
        { CONNECT: true },
        `Voice Bot: The owner (${msg.author.username}) wants to allow a user (${allowed.user.username}) in his channel`
      );
      msg.channel.send(`${allowed.user.username} is now permitted!`);
    } else {
      msg.channel.send('User not found, please try again.');
    }
  } catch (error) {
    console.error(error);
  }
}

export async function rejectUser(msg: Message) {
  try {
    const rejected = msg.mentions.members?.first();
    if (rejected) {
      await rejected.voice.kick(
        `Voice Bot: The owner (${msg.author.username}) wants to kick a user (${rejected.user.username}) in his channel`
      );
      msg.channel.send(`${rejected.user.username} has been kicked!`);
    }
  } catch (error) {
    console.log(error);
  }
}

export async function setUserChannelLimit(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  try {
    await channel.setUserLimit(
      +args,
      `Voice Bot: Asked by his owner (${msg.author.username})`
    );
    msg.channel.send('The user limit has correctly been set!');
  } catch (error) {
    console.error(error);
  }
}

export async function claimChannel(
  msg: Message,
  channel: VoiceChannel,
  userId: string
) {
  // We need to check if the current owner is in the channel
  const ownerMember = channel.members.get(userId);
  if (!ownerMember) {
    editOwning({
      ownedChannelId: channel.id,
      userId: msg.author.id,
    });
    msg.channel.send('You are now the owner of the channel!');
  } else {
    msg.channel.send(`You can't own this channel right now.`);
  }
}

export function generateHelpEmbed(client: Client) {
  return {
    embed: {
      author: {
        name: client.user?.username,
        icon_url: client.user?.avatarURL(),
      },
      title: 'Help',
      description: 'Commands list',
      fields: [
        {
          name: 'name your_channel_name',
          value: 'Allows you to rename your channel',
        },
        {
          name: 'lock',
          value: 'Allows you to lock your channel, nobody can join it',
        },
        {
          name: 'permit username',
          value: 'Allows a user to enter your locked channel',
        },
        {
          name: 'unlock',
          value: 'Unlocks your channel to everyone',
        },
        {
          name: 'reject',
          value: 'Kicks a user out of your channel',
        },
        {
          name: 'limit',
          value: 'Sets a user limit to your channel',
        },
      ],
      timestamp: new Date(),
      footer: {
        icon_url: client.user?.avatarURL(),
      },
    },
  };
}
