import {
  Message,
  VoiceChannel,
  Client,
  Guild,
  TextChannel,
  GuildMember,
  DiscordAPIError,
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
      `ℹ️ The channel has been renamed into **${args}**, ${msg.author.username}!`
    );
  } catch (error) {
    handleErrors(msg, error);
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
    msg.channel.send('🔒 The channel is now **locked**');
  } catch (error) {
    handleErrors(msg, error);
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
    msg.channel.send('🔓 Channel **unlocked**');
  } catch (error) {
    handleErrors(msg, error);
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
        msg.channel.send(`✅ **${allowed.user.username}** is now permitted!`);
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
        msg.channel.send(`✅ **@${allowed.name}** members are now permitted!`);
      }
    } else {
      msg.channel.send('User or role not found, please try again.');
    }
  } catch (error) {
    handleErrors(msg, error);
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
      msg.channel.send(`💢 **${rejected.user.username}** has been kicked!`);
      clearChannel(msg.channel as TextChannel, 2);
    } else {
      msg.channel.send('User not found, please try again.');
      clearChannel(msg.channel as TextChannel, 2);
    }
  } catch (error) {
    handleErrors(msg, error);
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
    msg.channel.send(`✋ User limit set to **${args}**`);
  } catch (error) {
    handleErrors(msg, error);
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
    msg.channel.send('💪 You are now the **owner** of the channel!');
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
  if (bitrate >= 8000 && bitrate <= 96000) {
    try {
      await channel.setBitrate(bitrate);
      msg.channel.send(`👂 Channel bitrate set to **${args}bps**`);
    } catch (error) {
      handleErrors(msg, error);
    }
  } else {
    msg.channel.send('Please give a number between 8000bps and 96000bps.');
  }
}

export function generateHelpEmbed(voiceChatBot: Client) {
  return {
    embed: {
      author: {
        name: voiceChatBot.user?.username,
        icon_url: voiceChatBot.user?.avatarURL(),
      },
      title: 'Commands list',
      description: `Here are all the commands you can run:\n
      **name <channel_name>**
      Allow you to rename your channel\n

      **lock**
      Allow you to lock your channel, nobody can join it\n

      **permit <@someone/@role/username>**
      Allow a user or role members provided to enter your locked channel\n

      **unlock**
      Open your locked channel to everyone\n

      **reject <@someone/username>**
      Kick a user out of your channel\n

      **claim**
      Allow anyone to get the own of the channel after his previous owner left\n

      **limit <number>**
      Set a user limit to your channel\n

      **bitrate <number>**
      Set the channel bitrate`,
      timestamp: new Date(),
      image: {
        url:
          'https://cdn.discordapp.com/attachments/681483039032999962/703017371215986688/LdB8ROR.gif',
      },
      color: 6465260,
      thumbnail: {
        url: voiceChatBot.user?.avatarURL(),
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

export function handleErrors(msg: Message, error: DiscordAPIError) {
  switch (error.code) {
    case 50001:
      msg.channel.send(
        `Oops! It seems like I'm missing access to perform this action. Please make sure I'm not missing accesses on channels.`
      );
      break;
    case 50013:
      msg.channel.send(
        `Oops! It seems like I'm missing permissions to perform this action. Please make sure I'm not missing permissions on channels.`
      );
      break;
    default:
      msg.channel.send(
        'Hmm... something went wrong... Please try again or check I correctly have everything I need.'
      );
      break;
  }
  console.error(error);
}
