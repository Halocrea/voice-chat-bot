import { Message, VoiceChannel } from 'discord.js';
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
  } catch (error) {
    console.error(error);
  }
}

export async function unlockChannel(channel: VoiceChannel) {
  try {
    await channel.lockPermissions();
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
    msg.channel.send('You are now the owner of the channel');
  } else {
    msg.channel.send(`You can't own this channel right now.`);
  }
}
