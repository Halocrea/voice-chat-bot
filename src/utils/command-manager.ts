import {
  Message,
  VoiceChannel,
  Client,
  Guild,
  TextChannel,
  GuildMember,
} from 'discord.js';
import { editOwning } from './owning-manager';
import {
  getChannelName,
  editHistoryName,
  addHistoryName,
} from './history-name-manager';
import {
  addHistoryPermission,
  deleteAllHistoryPermissions,
} from './history-permission-manager';

export async function renameChannel(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  const historyName = getChannelName(msg.author.id);
  const newHistoryName = {
    userId: msg.author.id,
    channelName: args,
  };
  if (historyName) {
    editHistoryName(newHistoryName);
  } else {
    addHistoryName(newHistoryName);
  }
  try {
    await channel.edit(
      { name: args },
      `Voice Bot: Asked by his owner (${msg.author.username})`
    );
    msg.channel.send(
      `The channel has been correctly renamed into ${args}, ${msg.author.username}!`
    );
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
    await channel.updateOverwrite(
      msg.guild?.id!,
      { CONNECT: true },
      `Voice Bot: The owner (${msg.author.username}) wants to unlock the channel`
    );
    deleteAllHistoryPermissions(msg.author.id);
    msg.channel.send('The channel is no longer locked.');
  } catch (error) {
    console.error(error);
  }
}

export async function permitUser(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  try {
    const allowed =
      msg.mentions.members?.first() ??
      msg.mentions.roles.first() ??
      (await findUserInGuildByName(msg.guild!, args));
    if (allowed) {
      // So now we need to check if the owner sent a member or a role
      if (allowed instanceof GuildMember) {
        await channel.updateOverwrite(
          allowed,
          { CONNECT: true },
          `Voice Bot: The owner (${msg.author.username}) wants to allow a user (${allowed.user.username}) in his channel`
        );
        addHistoryPermission({
          userId: msg.author.id,
          permittedUserId: allowed.user.id,
        });
        msg.channel.send(`${allowed.user.username} is now permitted!`);
      } else {
        await channel.updateOverwrite(
          allowed,
          { CONNECT: true },
          `Voice Bot: The owner (${msg.author.username}) wants to allow a user (${allowed.name}) in his channel`
        );
        addHistoryPermission({
          userId: msg.author.id,
          permittedUserId: allowed.id,
        });
        msg.channel.send(`@${allowed.name} members are now permitted!`);
      }
    } else {
      msg.channel.send('User or role not found, please try again.');
    }
  } catch (error) {
    console.error(error);
  }
}

export async function rejectUser(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  try {
    const rejected =
      msg.mentions.members?.first() ??
      (await findUserInGuildByName(msg.guild!, args));
    if (rejected) {
      await rejected.voice.kick(
        `Voice Bot: The owner (${msg.author.username}) wants to kick a user (${rejected.user.username}) in his channel`
      );
      channel.updateOverwrite(
        rejected,
        { CONNECT: false },
        `Kicked user (${rejected.user.username}) locked out of the channel`
      );
      msg.channel.send(`${rejected.user.username} has been kicked!`);
      clearChannel(msg.channel as TextChannel, 2);
    } else {
      msg.channel.send('User not found, please try again.');
      clearChannel(msg.channel as TextChannel, 2);
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

export async function setChannelBitrate(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  const bitrate = +args;
  if (bitrate >= 8 && bitrate <= 96) {
    try {
      await channel.setBitrate(bitrate);
    } catch (error) {
      console.error(error);
    }
  } else {
    msg.channel.send('Please give a number between 8kbps and 96kbps.');
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
          name: 'permit @someone/username',
          value: 'Allows a user to enter your locked channel',
        },
        {
          name: 'unlock',
          value: 'Unlocks your channel to everyone',
        },
        {
          name: 'reject @someone/username',
          value: 'Kicks a user out of your channel',
        },
        {
          name: 'limit <number>',
          value: 'Sets a user limit to your channel',
        },
        {
          name: 'bitrate <number>',
          value: 'Sets the channel bitrate',
        },
      ],
      timestamp: new Date(),
      footer: {
        icon_url: client.user?.avatarURL(),
      },
    },
  };
}

async function findUserInGuildByName(guild: Guild, name: string) {
  let member;
  try {
    const members = await guild.members.fetch();
    member = members.find(
      (user) => user.nickname === name || user.user.username === name
    );
  } catch (error) {
    console.error(error);
  }
  return member;
}

export function clearChannel(channel: TextChannel, nbMessages: number) {
  setTimeout(() => {
    (channel as TextChannel).bulkDelete(nbMessages);
  }, 1500);
}
