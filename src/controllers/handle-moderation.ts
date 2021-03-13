import { Client, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import { getGuildSetup } from '../models/GuildSetup';
import {
  ModerationRole,
  addModerationRole,
  deleteOneModerationRole,
  getAllModerationRoles,
} from '../models/ModerationRoles';

dotenv.config();

export function handleModeration(
  voiceChatBot: Client,
  msg: Message,
  cmd: string
) {
  switch (cmd) {
    case 'add-moderation-role':
      addRoleToModeration(msg);
      break;
    case 'list-moderation-role':
      listModerationRoles(msg);
      break;
    case 'remove-moderation-role':
      removeRoleFromModeration(msg);
      break;
    case 'moderation-help':
      helpModeration(voiceChatBot, msg);
      break;
  }
}

function addRoleToModeration(msg: Message) {
  const role = msg.mentions.roles.first();
  if (role) {
    const moderationRole: ModerationRole = {
      guildId: msg.guild!.id,
      roleId: role.id,
    };
    addModerationRole(moderationRole);
    msg.channel.send('✅ Role has been successfully added to the moderation');
  } else {
    msg.channel.send(
      'Please use a role ping to add this role to the moderation'
    );
  }
}

function listModerationRoles(msg: Message) {
  const rawRolesIds = getAllModerationRoles(msg.guild!.id);
  if (rawRolesIds.length) {
    const rolesIds = rawRolesIds.map((role) => role.roleId);
    const moderationRoles = msg
      .guild!.roles.cache.filter((role) => rolesIds.includes(role.id))
      .map((role) => role);
    const moderationRolesList = moderationRoles.join('\n');
    msg.channel.send({
      embed: {
        title: 'Here are all the roles allowed to moderate',
        description: `${moderationRolesList}`,
        color: 13632027,
        timestamp: new Date(),
      },
    });
  } else {
    msg.channel.send(
      "You don't have any moderation role, please use add-moderation-role command to add one."
    );
  }
}

function removeRoleFromModeration(msg: Message) {
  const role = msg.mentions.roles.first();
  if (role) {
    const moderationRole: ModerationRole = {
      guildId: msg.guild!.id,
      roleId: role.id,
    };
    deleteOneModerationRole(moderationRole);
    msg.channel.send(
      '💢 Role has been successfully removed from the moderation'
    );
  } else {
    msg.channel.send(
      'Please use a role ping to remove this role from the moderation'
    );
  }
}

function helpModeration(voiceChatBot: Client, msg: Message) {
  const guildSetup = getGuildSetup(msg.guild!.id);
  const cmdPrefix =
    guildSetup && guildSetup.prefix
      ? guildSetup.prefix
      : process.env.CMD_PREFIX;
  msg.channel.send({
    embed: {
      author: {
        name: voiceChatBot.user?.username,
        icon_url: voiceChatBot.user?.avatarURL(),
      },
      title: `Moderation roles commands list`,
      description: `Here are all the setup commands you can run as an Administrator:\n
      **${cmdPrefix} add-moderation-role <@role>**
      Add a role allowed to moderate the bot\n

      **${cmdPrefix} list-moderation-role**
      List all the roles allowed to moderate the bot\n

      **${cmdPrefix} remove-moderation-role <@role>**
      Remove a role no longer allowed to moderate the bot`,
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
  });
}
