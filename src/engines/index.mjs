import * as anthropic from './anthropic.mjs';
import * as openai from './openai.mjs';
import * as gemini from './gemini.mjs';
import * as perplexity from './perplexity.mjs';

export const MOTORES = { anthropic, openai, gemini, perplexity };

export const MODELOS_PADRAO = {
	anthropic: 'claude-haiku-4-5-20251001',
	openai: 'gpt-4.1-mini',
	gemini: 'gemini-2.5-flash',
	perplexity: 'sonar'
};
