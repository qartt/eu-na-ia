import { buscar } from '../util.mjs';

export const chave = 'GEMINI_API_KEY';
export const rotulo = 'Gemini (Google)';

/** generateContent com grounding na Busca Google. */
export async function perguntar(pergunta, { apiKey, modelo, fetchImpl }) {
	const r = await buscar(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
		method: 'POST',
		timeout: 120000,
		headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
		body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: pergunta }] }], tools: [{ google_search: {} }] })
	}, fetchImpl);
	const d = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
	return extrair(d);
}

export function extrair(d) {
	const cand = Array.isArray(d?.candidates) ? d.candidates[0] : null;
	const texto = (cand?.content?.parts || []).map((p) => p.text || '').join('');
	const urls = [];
	// As URIs do grounding são redirecionamentos; o "title" traz o domínio de origem.
	for (const ch of cand?.groundingMetadata?.groundingChunks || []) {
		const w = ch?.web;
		if (!w) continue;
		if (w.title && /^[\w.-]+\.[a-z]{2,}$/i.test(w.title)) urls.push(`https://${w.title}`);
		else if (w.uri) urls.push(w.uri);
	}
	return { texto, urls: [...new Set(urls)] };
}
