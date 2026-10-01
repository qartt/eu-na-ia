import { buscar } from '../util.mjs';

export const chave = 'ANTHROPIC_API_KEY';
export const rotulo = 'Claude (Anthropic)';

/** Messages API com a ferramenta de busca na web. */
export async function perguntar(pergunta, { apiKey, modelo, fetchImpl }) {
	const r = await buscar('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		timeout: 120000,
		headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
		body: JSON.stringify({
			model: modelo,
			max_tokens: 1200,
			messages: [{ role: 'user', content: pergunta }],
			tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
		})
	}, fetchImpl);
	const d = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
	return extrair(d);
}

export function extrair(d) {
	const blocos = Array.isArray(d?.content) ? d.content : [];
	const texto = blocos.filter((b) => b.type === 'text').map((b) => b.text || '').join('');
	const urls = [];
	for (const b of blocos) {
		if (b.type === 'text' && Array.isArray(b.citations)) b.citations.forEach((c) => c?.url && urls.push(c.url));
		if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach((c) => c?.url && urls.push(c.url));
	}
	return { texto, urls: [...new Set(urls)] };
}
