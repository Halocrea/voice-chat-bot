import * as discord from 'discord.js';
import * as dotenv from 'dotenv';
import {
  addOwning,
  removeOwning,
  getOwner,
  editOwning,
} from './utils/owning-manager';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('message', async (msg) => {
  const cmdVoice = process.env.CMD_VOICE;
  if (cmdVoice && msg.content.startsWith(cmdVoice)) {
    // We have to check if the user is in a channel & if he owns it
    const channel = msg.member?.voice.channel;
    if (channel) {
      const { userId } = getOwner(channel.id);
      if (userId === msg.author.id) {
        const cmdAndArgs = msg.content.replace(cmdVoice, '').trim().split(' ');
        const cmd = cmdAndArgs.shift();
        const args = cmdAndArgs.join(' ').trim();

        switch (cmd) {
          case 'name':
            await channel.edit(
              { name: args },
              `Voice Bot: Asked by his owner (${msg.author.username})`
            );
            break;
          case 'lock':
            await channel.overwritePermissions(
              [
                {
                  id: msg.guild?.id!,
                  deny: ['CONNECT'],
                },
                {
                  id: userId,
                  allow: ['CONNECT'],
                },
                {
                  id: msg.client.user?.id!,
                  allow: ['MANAGE_CHANNELS'],
                },
              ],
              `Voice Bot: The owner (${msg.author.username}) wants to lock the channel`
            );
            break;
          case 'unlock':
            await channel.lockPermissions();
            break;
          case 'permit':
            break;
          case 'limit':
            await channel.edit(
              { userLimit: +args },
              `Voice Bot: Asked by his owner (${msg.author.username})`
            );
            break;
          case 'claim':
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
            break;
          case 'help':
            msg.channel.send('Help lol');
            break;
          default:
            msg.channel.send(
              'Unknown command, please try again or use help command.'
            );
            break;
        }
      } else {
        msg.channel.send('You have to own this channel to run commands');
      }
    } else {
      msg.channel.send('You have to be in a voice channel to run commands.');
    }
  }
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) => {
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === process.env.CREATING_CHANNEL_ID) {
    try {
      // We create the channel
      const creator = await newState.guild.members.fetch(newState.id);
      const newGuildChannel = await newState.guild.channels.create(
        `${creator.user.username}'s channel`,
        { type: 'voice', parent: process.env.VOICE_CATEGORY_ID }
      );
      // We move the user inside his new channel
      const newChannel = await newGuildChannel.fetch();
      newState.setChannel(newChannel, 'A user creates a new channel');
      addOwning({
        userId: newState.id,
        ownedChannelId: newChannel.id,
      });
    } catch (error) {
      console.error(error);
    }
  }

  // Having null as an old state channel id means that the user wasn't in a vocal channel before
  if (oldState.channelID) {
    const channelLeft = newState.guild.channels.resolve(oldState.channelID);
    let memberCount = 0;
    for (const _ of channelLeft!.members) memberCount++;
    if (
      channelLeft &&
      !memberCount &&
      channelLeft.id !== process.env.CREATING_CHANNEL_ID
    ) {
      await channelLeft.lockPermissions();
      channelLeft
        .delete('Channel empty')
        .then(() => removeOwning(channelLeft.id))
        .catch(console.error);
    }
  }
});

function claim(
  msg: discord.Message,
  channel: discord.VoiceChannel,
  ownerId: string
) {
  // We need to check if the current owner is in the channel
  const ownerMember = channel.members.get(ownerId);
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

voiceChatBot.login(process.env.TOKEN);
