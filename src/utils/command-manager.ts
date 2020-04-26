import {
  Message,
  VoiceChannel,
  Client,
  Guild,
  TextChannel,
  GuildMember,
  DiscordAPIError,
  OverwriteResolvable,
} from 'discord.js';
import { editOwning, getOwner } from './owning-manager';
import {
  addHistoryPermission,
  deleteAllHistoryPermissions,
  getAllHistoryPermissions,
} from './history-permission-manager';
import { getLocalGuild } from './local-guild-manager';
import {
  getHistoric,
  editHistoricName,
  addHistoricName,
  addHistoricLimit,
  editHistoricLimit,
} from './history-manager';

export async function handleCommand(
  voiceChatBot: Client,
  msg: Message,
  cmd: string,
  args: string
) {
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
            msg.channel.send('You already are the owner of this channel 🤔');
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

async function renameChannel(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  // We keep this name in DB
  const history = getHistoric(msg.author.id);
  const newHistory = {
    userId: msg.author.id,
    channelName: args,
  };
  if (history) {
    editHistoricName(newHistory);
  } else {
    addHistoricName(newHistory);
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

async function lockChannel(
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

    // We ask the user if he wants to load his last permissions
    const creator = msg.author;
    const localGuild = getLocalGuild(msg.guild!.id);
    const historyPermissions = getAllHistoryPermissions(creator.id);
    if (historyPermissions && historyPermissions.length > 0) {
      const commandsChannel = msg.guild!.channels.resolve(
        localGuild.commandsChannelId
      ) as TextChannel;
      if (commandsChannel && commandsChannel.type === 'text') {
        // We get the nickname of each potential allowed member
        let allowedMembersAndRoles = '';
        try {
          const allowedIdsList = historyPermissions.map(
            (perm) => perm.permittedUserId
          );

          // We get all concerned members
          const members = await msg.guild!.members.fetch({
            user: allowedIdsList,
          });
          const allowedMembers =
            members.array().length > 0
              ? members.map((member) => member.user)
              : [];

          // We get all concerned roled
          const allowedRoles = msg
            .guild!.roles.cache.filter((role) =>
              allowedIdsList.includes(role.id)
            )
            .map((role) => role);

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
              title: 'Do you want to load your last permissions?',
              description: `Those members/roles would be allowed:\n\n${allowedMembersAndRoles}`,
              color: 7944435,
              timestamp: new Date(),
            },
          })
          .then((proposal) => {
            const accept = '✅';
            const deline = '❌';

            proposal.react(accept);
            proposal.react(deline);
            proposal
              .awaitReactions(
                (reaction, user) =>
                  [accept, deline].includes(reaction.emoji.name) &&
                  user.id === creator.id,
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
                  const permissions: OverwriteResolvable[] = historyPermissions.map(
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
                    id: msg.guild!.id,
                    deny: ['CONNECT'],
                  });
                  // We add the bot
                  permissions.push({
                    id: proposal.client.user!.id,
                    allow: [
                      'MANAGE_CHANNELS',
                      'MANAGE_ROLES',
                      'VIEW_CHANNEL',
                      'CONNECT',
                    ],
                  });
                  channel.edit({ permissionOverwrites: permissions });
                  proposal.channel.send('✅ Last permissions **loaded**');
                  proposal.delete();
                } else {
                  // We clear his history
                  deleteAllHistoryPermissions(creator.id);
                  proposal.channel.send('❌ Last permissions **not loaded**');
                  proposal.delete();
                }
              })
              .catch(() => {
                // We clear his history
                deleteAllHistoryPermissions(creator.id);
                proposal.delete();
              });
          })
          .catch(console.error);
      }
    }
  } catch (error) {
    handleErrors(msg, error);
  }
}

async function unlockChannel(msg: Message, channel: VoiceChannel) {
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

async function permitUser(msg: Message, channel: VoiceChannel, args: string) {
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

async function rejectUser(msg: Message, channel: VoiceChannel, args: string) {
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

async function setUserChannelLimit(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  if (+args >= 0 && +args <= 99) {
    // We keep this user limit in DB
    const history = getHistoric(msg.author.id);
    const newHistory = {
      userId: msg.author.id,
      userLimit: +args,
    };
    if (history) {
      editHistoricLimit(newHistory);
    } else {
      addHistoricLimit(newHistory);
    }
    try {
      await channel.setUserLimit(
        +args,
        `Voice Bot: Asked by his owner (${msg.author.username})`
      );
      msg.channel.send(
        `✋ User limit set to **${+args > 0 ? args : 'unlimited'}**`
      );
    } catch (error) {
      handleErrors(msg, error);
    }
  } else {
    msg.channel.send(`Please send a value between **0** and **99**`);
  }
}

async function claimChannel(
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

async function setChannelBitrate(
  msg: Message,
  channel: VoiceChannel,
  args: string
) {
  // 96kbps is the tier 0 bitrate max
  let bitrateMax = 96000;
  switch (msg.guild?.premiumTier) {
    case 1:
      bitrateMax = 128000;
      break;
    case 2:
      bitrateMax = 256000;
      break;
    case 3:
      bitrateMax = 384000;
      break;
  }
  const bitrate = +args;
  if (bitrate >= 8000 && bitrate <= bitrateMax) {
    try {
      await channel.setBitrate(bitrate);
      msg.channel.send(`👂 Channel bitrate set to **${args}bps**`);
    } catch (error) {
      handleErrors(msg, error);
    }
  } else {
    msg.channel.send(
      `Please give a number between 8000bps and ${bitrateMax}bps.`
    );
  }
}

function generateHelpEmbed(voiceChatBot: Client) {
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

      **limit <0 <= number <= 99>**
      Set a user limit to your channel (Here 0 means **unlimited**)\n

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

function clearChannel(channel: TextChannel, nbMessages: number) {
  setTimeout(() => {
    (channel as TextChannel).bulkDelete(nbMessages);
  }, 1500);
}

function handleErrors(msg: Message, error: DiscordAPIError) {
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
        'Hmm... something went wrong... Please try again or check that I correctly have everything I need.'
      );
      break;
  }
  console.error(error);
}
