import { ChatInputCommandInteraction } from 'discord.js';
import * as voice from './voice';
import * as voiceMod from './voice-mod';
import * as voiceSetup from './voice-setup';

export interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<void>;
}

export const commands: Command[] = [voice, voiceSetup, voiceMod];
