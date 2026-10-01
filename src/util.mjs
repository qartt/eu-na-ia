export const VERSAO = '1.1.0';
export const PROJETO_URL = 'https://github.com/qartt/eu-na-ia';
export const USER_AGENT = `EuNaIA-Checkup/${VERSAO} (+${PROJETO_URL})`;

/** Minúsculas, sem acentos e com espaços normalizados. */
export function normalizar(s) {
	return String(s || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function escHtml(s) {
	return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function escMd(s) {
	return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function hoje(d = new Date()) {
	return d.toISOString().slice(0, 10);
}

export function hostDe(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
	} catch {
		return '';
	}
}

/** fetch com timeout e user-agent; nunca lança por status HTTP. */
export async function buscar(url, opts = {}, fetchImpl = globalThis.fetch) {
	const { timeout = 20000, headers = {}, ...rest } = opts;
	return fetchImpl(url, {
		redirect: 'follow',
		...rest,
		headers: { 'user-agent': USER_AGENT, ...headers },
		signal: AbortSignal.timeout(timeout)
	});
}

export function preencher(modelo, dados) {
	return String(modelo).replace(/\{(\w+)\}/g, (m, k) => (dados[k] != null && dados[k] !== '' ? dados[k] : m));
}
