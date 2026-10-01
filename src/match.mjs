import { normalizar, hostDe } from './util.mjs';

function escRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Procura menções por texto, de forma determinística (nenhum modelo decide se "viu" você).
 * Nome completo conta como menção; usuário do GitHub e domínios também.
 */
export function analisarResposta({ texto, urls }, termos) {
	const t = normalizar(texto);
	const achados = [];
	for (const nome of termos.nomes) {
		const n = normalizar(nome);
		if (n && new RegExp(`(^|[^a-z0-9])${escRe(n)}([^a-z0-9]|$)`).test(t)) achados.push(nome);
	}
	if (termos.usuario && new RegExp(`(^|[^a-z0-9-])@?${escRe(termos.usuario.toLowerCase())}([^a-z0-9-]|$)`).test(t)) achados.push(`@${termos.usuario}`);
	for (const d of termos.dominios) if (t.includes(d.toLowerCase())) achados.push(d);

	const proprios = new Set(termos.dominios.map((d) => d.toLowerCase()));
	const citacoes = (urls || []).filter((u) => {
		const h = hostDe(u);
		if (proprios.has(h)) return true;
		if (h === 'github.com' || h.endsWith('.github.io')) return String(u).toLowerCase().includes(termos.usuario.toLowerCase());
		return false;
	});

	let trecho = '';
	if (achados.length) {
		const alvo = normalizar(achados[0].replace(/^@/, ''));
		const i = t.indexOf(alvo);
		if (i >= 0) {
			// usa o texto original (mesmo comprimento salvo em acentos compostos raros)
			const ini = Math.max(0, i - 80);
			trecho = String(texto).replace(/\s+/g, ' ').trim().slice(ini, ini + 220).trim();
		}
	}
	return { mencionado: achados.length > 0, termos: [...new Set(achados)], citado: citacoes.length > 0, citacoes: [...new Set(citacoes)], trecho };
}
