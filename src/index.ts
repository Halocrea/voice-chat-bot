import * as discord from 'discord.js';
import * as dotenv from 'dotenv';
import {
  addOwning,
  removeOwning,
  getOwner,
  editOwning,
} from './utils/owning-manager';
import {
  renameChannel,
  lockChannel,
  unlockChannel,
  permitUser,
  setUserChannelLimit,
  claimChannel,
  rejectUser,
  generateHelpEmbed,
} from './utils/command-manager';
import { getChannelName } from './utils/history-name-manager';
import { getAllHistoryPermissions } from './utils/history-permission-manager';

dotenv.config();
const voiceChatBot = new discord.Client();

voiceChatBot.on('ready', () => {
  voiceChatBot.user?.setActivity(`${process.env.CMD_VOICE} help`, {
    type: 'LISTENING',
  });
});

voiceChatBot.on('message', async (msg) => {
  const cmdVoice = process.env.CMD_VOICE;
  if (cmdVoice && msg.content.startsWith(cmdVoice)) {
    // We have to check if the user is in a channel & if he owns it
    const cmdAndArgs = msg.content.replace(cmdVoice, '').trim().split(' ');
    const cmd = cmdAndArgs.shift();
    const args = cmdAndArgs.join(' ').trim();
    if (cmd !== 'help') {
      const channel = msg.member?.voice.channel;
      if (channel) {
        const { userId } = getOwner(channel.id);
        if (userId === msg.author.id) {
          switch (cmd) {
            case 'name':
              renameChannel(msg, channel, args);
              break;
            case 'lock':
              lockChannel(msg, channel, userId);
              break;
            case 'unlock':
              unlockChannel(msg, channel);
              break;
            case 'permit':
              permitUser(msg, channel, args);
              break;
            case 'reject':
              rejectUser(msg, args);
              break;
            case 'limit':
              setUserChannelLimit(msg, channel, args);
              break;
            default:
              msg.channel.send(
                'Unknown command, please try again or use help command.'
              );
              break;
          }
        } else if (cmd === 'claim') {
          claimChannel(msg, channel, userId);
        } else {
          msg.channel.send('You have to own this channel to run commands');
        }
      } else {
        msg.channel.send('You have to be in a voice channel to run commands.');
      }
    } else {
      msg.channel.send(generateHelpEmbed(voiceChatBot));
    }
  }
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) => {
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === process.env.CREATING_CHANNEL_ID) {
    try {
      // We create the channel
      const creator = await newState.guild.members.fetch(newState.id);
      const channelName =
        getChannelName(creator.user.id) ?? `${creator.user.username}'s channel`;

      const historyPermissions = getAllHistoryPermissions(creator.user.id);
      let permissions: discord.OverwriteResolvable[] = [];
      if (historyPermissions && historyPermissions.length > 0) {
        // We add every permission registred
        permissions = historyPermissions.map((perm) => ({
          id: perm.permittedUserId,
          allow: ['CONNECT'],
        }));
        // We add the owner
        permissions.push({
          id: creator.id,
          allow: ['CONNECT'],
        });
        // We deny everyone
        permissions.push({
          id: newState.guild.id,
          deny: ['CONNECT'],
        });
      }
      // The bot permissions
      permissions.push({
        id: newState.client.user!.id,
        allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'VIEW_CHANNEL', 'CONNECT'],
      });

      const newGuildChannel = await newState.guild.channels.create(
        channelName,
        {
          type: 'voice',
          parent: process.env.VOICE_CATEGORY_ID,
          permissionOverwrites: permissions,
        }
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
      channelLeft.parentID === process.env.VOICE_CATEGORY_ID &&
      channelLeft.id !== process.env.CREATING_CHANNEL_ID
    ) {
      try {
        await channelLeft.lockPermissions();
        channelLeft
          .delete('Channel empty')
          .then(() => removeOwning(channelLeft.id))
          .catch(console.error);
      } catch (error) {
        console.error(error);
      }
    }
  }
});

voiceChatBot.login(process.env.TOKEN);
