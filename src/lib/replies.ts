import {
  ChatInputCommandInteraction,
  DiscordAPIError,
  InteractionReplyOptions,
  MessageFlags,
} from 'discord.js';

/**
 * Every answer this bot gives is ephemeral: it's a reply to the person who ran
 * the command, nobody else needs to see it. This is what replaces the old
 * "commands channel" and its bulkDelete cleanup hack.
 */
export async function respond(
  interaction: ChatInputCommandInteraction,
  options: Omit<InteractionReplyOptions, 'flags'>,
) {
  const payload = { ...options, flags: MessageFlags.Ephemeral } as const;
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

const MISSING_ACCESS = 50001;
const MISSING_PERMISSIONS = 50013;

export function describeError(error: unknown): string {
  if (
    error instanceof DiscordAPIError &&
    (error.code === MISSING_ACCESS || error.code === MISSING_PERMISSIONS)
  ) {
    return `Oops! It seems I'm missing some permissions to perform this action. Please make sure I am allowed to do this.`;
  }
  return 'Hmm... something went wrong... Please try again or make sure I have been properly configured.';
}

export async function respondWithError(
  interaction: ChatInputCommandInteraction,
  error: unknown,
) {
  // A one-line summary before the stack trace: which call failed, and why.
  // "Missing Permissions" alone never says *what* Discord refused.
  if (error instanceof DiscordAPIError) {
    console.error(
      `[${interaction.commandName} ${interaction.options.getSubcommand(false) ?? ''}] ` +
        `Discord error ${error.code} (HTTP ${error.status}) on ${error.method} ${error.url} — ${error.message}`,
    );
  }
  console.error(error);
  try {
    await respond(interaction, { content: describeError(error) });
  } catch (replyError) {
    // The interaction token may already be dead; nothing left to do but log
    console.error(replyError);
  }
}
