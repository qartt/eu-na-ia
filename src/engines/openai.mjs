import { buscar } from '../util.mjs';

export const chave = 'OPENAI_API_KEY';
export const rotulo = 'ChatGPT (OpenAI)';

/** Responses API com a ferramenta de busca na web. */
export async function perguntar(pergunta, { apiKey, modelo, fetchImpl }) {
	const r = await buscar('https://api.openai.com/v1/responses', {
		method: 'POST',
		timeout: 120000,
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({ model: modelo, input: pergunta, tools: [{ type: 'web_search' }] })
	}, fetchImpl);
	const d = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
	return extrair(d);
}

export function extrair(d) {
	let texto = typeof d?.output_text === 'string' ? d.output_text : '';
	const urls = [];
	for (const item of Array.isArray(d?.output) ? d.output : []) {
		if (item.type !== 'message') continue;
		for (const c of Array.isArray(item.content) ? item.content : []) {
			if (c.type !== 'output_text') continue;
			if (!d.output_text) texto += c.text || '';
			(c.annotations || []).forEach((a) => a?.url && urls.push(a.url));
		}
	}
	return { texto, urls: [...new Set(urls)] };
}
