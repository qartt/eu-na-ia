import { buscar } from '../util.mjs';

export const chave = 'PERPLEXITY_API_KEY';
export const rotulo = 'Perplexity';

export async function perguntar(pergunta, { apiKey, modelo, fetchImpl }) {
	const r = await buscar('https://api.perplexity.ai/chat/completions', {
		method: 'POST',
		timeout: 120000,
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({ model: modelo, messages: [{ role: 'user', content: pergunta }] })
	}, fetchImpl);
	const d = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
	return extrair(d);
}

export function extrair(d) {
	const texto = d?.choices?.[0]?.message?.content || '';
	const urls = [...(Array.isArray(d?.citations) ? d.citations : []), ...(Array.isArray(d?.search_results) ? d.search_results.map((s) => s?.url) : [])].filter(Boolean);
	return { texto, urls: [...new Set(urls)] };
}
