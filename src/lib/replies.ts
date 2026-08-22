import {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageFlags,
} from 'discord.js';
import { describeThrown, isPermissionError, levelFor, logger } from './logger';

/**
 * Every answer this bot gives is ephemeral: it's a reply to the person who ran
 * the command, nobody else needs to see it. This is what replaces the old
 * "commands channel" and its bulkDelete cleanup hack.
 */
export async function respond(
  interaction: ChatInputCommandInteraction,
  options: Omit<InteractionReplyOptions, 'flags'>,
) {
  // The router defers every command, so the usual case is the first one: the
  // "thinking" placeholder is already on screen and has to be replaced rather
  // than answered again. editReply takes no flags — ephemerality was decided
  // when the interaction was deferred.
  if (interaction.deferred && !interaction.replied) {
    return interaction.editReply(options);
  }

  const payload = { ...options, flags: MessageFlags.Ephemeral } as const;
  if (interaction.replied) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

export function describeError(error: unknown): string {
  if (isPermissionError(error)) {
    return `Oops! It seems I'm missing some permissions to perform this action. Please make sure I am allowed to do this.`;
  }
  return 'Hmm... something went wrong... Please try again or make sure I have been properly configured.';
}

export async function respondWithError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
) {
  const subcommand = interaction.options.getSubcommand(false);
  const command = subcommand
    ? `/${interaction.commandName} ${subcommand}`
    : `/${interaction.commandName}`;

  logger.log(levelFor(error), `${command} failed`, {
    err: describeThrown(error),
    guildId: interaction.guildId,
  });

  try {
    await respond(interaction, { content: describeError(error) });
  } catch (replyError) {
    // The interaction token may already be dead; there is nothing left to try
    logger.warn(`Could not tell the user that ${command} failed`, {
      err: describeThrown(replyError),
    });
  }
}
