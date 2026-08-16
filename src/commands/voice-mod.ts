import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { canConfigureBot } from '../lib/permissions';
import { respond, respondWithError } from '../lib/replies';
import {
  addModerationRole,
  deleteOneModerationRole,
  getAllModerationRoles,
} from '../models/ModerationRoles';

export const data = new SlashCommandBuilder()
  .setName('voice-mod')
  .setDescription('Choose which roles may moderate the voice channels')
  // No setDefaultMemberPermissions here on purpose: it is checked in code by
  // canConfigureBot so that the maintainer keeps their bypass
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Allow a role to moderate the voice channels')
      .addRoleOption((option) =>
        option
          .setName('role')
          .setDescription('The role to promote')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List the roles allowed to moderate'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Stop letting a role moderate the voice channels')
      .addRoleOption((option) =>
        option
          .setName('role')
          .setDescription('The role to demote')
          .setRequired(true),
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  if (!canConfigureBot(interaction.member)) {
    await respond(interaction, {
      content:
        'You must be an administrator of this server to change the moderation roles. 🛑',
    });
    return;
  }

  try {
    switch (interaction.options.getSubcommand()) {
      case 'add':
        await addRole(interaction);
        break;
      case 'list':
        await listRoles(interaction);
        break;
      case 'remove':
        await removeRole(interaction);
        break;
    }
  } catch (error) {
    await respondWithError(interaction, error);
  }
}

async function addRole(interaction: ChatInputCommandInteraction<'cached'>) {
  const role = interaction.options.getRole('role', true);
  const alreadyThere = getAllModerationRoles(interaction.guildId).some(
    (moderationRole) => moderationRole.roleId === role.id,
  );

  if (alreadyThere) {
    await respond(interaction, {
      content: `**${role.name}** already moderates the voice channels.`,
    });
    return;
  }

  addModerationRole({ guildId: interaction.guildId, roleId: role.id });
  await respond(interaction, {
    content: `✅ **${role.name}** has been successfully added to the moderation.`,
  });
}

async function listRoles(interaction: ChatInputCommandInteraction<'cached'>) {
  const roleIds = getAllModerationRoles(interaction.guildId).map(
    (moderationRole) => moderationRole.roleId,
  );

  if (!roleIds.length) {
    await respond(interaction, {
      content: `You don't have any moderation role, please use \`/voice-mod add\` to add one.`,
    });
    return;
  }

  const roles = roleIds
    .map((roleId) => interaction.guild.roles.cache.get(roleId))
    .filter((role) => !!role);

  await respond(interaction, {
    embeds: [
      new EmbedBuilder()
        .setTitle('Here are all the roles allowed to moderate')
        .setDescription(
          roles.length
            ? roles.join('\n')
            : 'None of the saved roles still exist on this server.',
        )
        .setColor(13632027)
        .setTimestamp(new Date()),
    ],
  });
}

async function removeRole(interaction: ChatInputCommandInteraction<'cached'>) {
  const role = interaction.options.getRole('role', true);
  deleteOneModerationRole({ guildId: interaction.guildId, roleId: role.id });
  await respond(interaction, {
    content: `💢 **${role.name}** has been successfully removed from the moderation.`,
  });
}
