import * as discord from 'discord.js';
import * as dotenv from 'dotenv';
import { addOwning, removeOwning, getOwner } from './utils/owning-manager';
import {
  renameChannel,
  lockChannel,
  unlockChannel,
  permitUser,
  setUserChannelLimit,
  claimChannel,
  rejectUser,
  generateHelpEmbed,
  clearChannel,
  setChannelBitrate,
} from './utils/command-manager';
import { getChannelName } from './utils/history-name-manager';
import {
  getAllHistoryPermissions,
  deleteAllHistoryPermissions,
} from './utils/history-permission-manager';
import { handleSetup } from './utils/setup-manager';
import { getLocalGuild } from './utils/local-guild-manager';

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
    const localGuild = getLocalGuild(msg.guild!.id);
    if (cmd?.match(/setup/) && msg.member?.hasPermission('ADMINISTRATOR')) {
      handleSetup(voiceChatBot, msg, cmd, args);
    } else if (localGuild) {
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
                rejectUser(msg, channel, args);
                break;
              case 'limit':
                setUserChannelLimit(msg, channel, args);
                break;
              case 'bitrate':
                setChannelBitrate(msg, channel, args);
                break;
              case 'claim':
                msg.channel.send(
                  'You already are the owner of this channel 🤔'
                );
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
          msg.channel.send(
            'You have to be in a voice channel to run commands.'
          );
        }
      } else {
        msg.channel.send(generateHelpEmbed(voiceChatBot));
      }
    } else {
      // The bot needs to be set up before being used
      msg.channel.send({
        embed: {
          title: 'DENIED! I need to be installed before being used',
          description:
            'Please ask an Administrator to install me using `!voice setup` command to use me, I need some configuration ☹️',
          color: 16711680,
          thumbnail: {
            url: voiceChatBot.user?.avatarURL(),
          },
          image: {
            url: 'https://i.imgur.com/ZIfiTGO.gif',
          },
          timestamp: new Date(),
          author: {
            name: voiceChatBot.user?.username,
            icon_url: voiceChatBot.user?.avatarURL(),
          },
        },
      });
    }
  }
});

voiceChatBot.on('voiceStateUpdate', async (oldState, newState) => {
  const localGuild = getLocalGuild(newState.guild.id);
  // Create a voice channel when a user join the "creating" channel
  if (newState.channelID === localGuild.creatingChannelId) {
    try {
      // We create the channel
      const creatorId = newState.id;
      const creator = await newState.guild.members.fetch(creatorId);
      const channelName =
        getChannelName(creator.user.id) ?? `${creator.user.username}'s channel`;

      const newGuildChannel = await newState.guild.channels.create(
        channelName,
        {
          type: 'voice',
          parent: localGuild.categoryId,
          permissionOverwrites: [
            {
              id: newState.client.user!.id,
              allow: [
                'MANAGE_CHANNELS',
                'MANAGE_ROLES',
                'VIEW_CHANNEL',
                'CONNECT',
              ],
            },
          ],
        }
      );

      // We move the user inside his new channel
      const newChannel = await newGuildChannel.fetch();
      newState.setChannel(newChannel, 'A user creates a new channel');
      addOwning({
        userId: creatorId,
        ownedChannelId: newChannel.id,
      });

      // We ask the user if he wants to load his last permissions
      const historyPermissions = getAllHistoryPermissions(creator.user.id);
      if (historyPermissions && historyPermissions.length > 0) {
        const commandsChannel = newState.guild.channels.resolve(
          localGuild.commandsChannelId
        ) as discord.TextChannel;
        if (commandsChannel && commandsChannel.type === 'text') {
          // We get the nickname of each potential allowed member
          let allowedMembersAndRoles = '';
          try {
            const allowedIdsList = historyPermissions.map(
              (perm) => perm.permittedUserId
            );

            // We get all concerned members
            const members = await newState.guild.members.fetch({
              user: allowedIdsList,
            });
            const allowedMembers =
              members.array().length > 0
                ? members.map((user) => user.nickname ?? user.user.username)
                : [];

            // We get all concerned roled
            const allowedRoles = newState.guild.roles.cache
              .filter((role) => allowedIdsList.includes(role.id))
              .map((role) => role.name);

            // We group everyone
            allowedMembersAndRoles = [...allowedMembers, ...allowedRoles].join(
              '\n'
            );
          } catch (error) {
            console.error(error);
          }

          commandsChannel
            .send({
              embed: {
                title:
                  'Do you want to lock your channel and load your last permissions?',
                description: `Those members/roles would be allowed:\n\n${allowedMembersAndRoles}`,
                color: 7944435,
                timestamp: new Date(),
              },
            })
            .then((msg) => {
              const accept = '✅';
              const deline = '❌';

              msg.react(accept);
              msg.react(deline);
              msg
                .awaitReactions(
                  (reaction, user) =>
                    [accept, deline].includes(reaction.emoji.name) &&
                    user.id === creatorId,
                  {
                    max: 1,
                    time: 2 * 60000,
                    errors: ['time'],
                  }
                )
                .then((collected) => {
                  const reaction = collected.first();
                  if (reaction?.emoji.name === accept) {
                    // We update every allowed user
                    const permissions: discord.OverwriteResolvable[] = historyPermissions.map(
                      (perm) => ({
                        id: perm.permittedUserId,
                        allow: ['CONNECT'],
                      })
                    );
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
                    // We add the bot
                    permissions.push({
                      id: newState.client.user!.id,
                      allow: [
                        'MANAGE_CHANNELS',
                        'MANAGE_ROLES',
                        'VIEW_CHANNEL',
                        'CONNECT',
                      ],
                    });
                    newChannel.edit({ permissionOverwrites: permissions });
                    setTimeout(() => {
                      msg.delete();
                    }, 1500);
                  } else {
                    // We clear his history
                    deleteAllHistoryPermissions(creatorId);
                    setTimeout(() => {
                      msg.delete();
                    }, 1000);
                  }
                })
                .catch(() => {
                  // We clear his history
                  deleteAllHistoryPermissions(creatorId);
                  msg.delete();
                });
            })
            .catch(console.error);
        }
      }
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
      channelLeft.parentID === localGuild.categoryId &&
      channelLeft.id !== localGuild.creatingChannelId
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
