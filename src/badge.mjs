import { escHtml } from './util.mjs';

/** Largura aproximada de texto em Verdana 11px (suficiente para selos). */
function largura(t) {
	let w = 0;
	for (const ch of String(t)) w += /[ilI.,:;|!'1]/.test(ch) ? 3.6 : /[mwMW@%]/.test(ch) ? 9.5 : /[A-Z0-9]/.test(ch) ? 7.4 : 6.4;
	return Math.ceil(w);
}

export function corPorNota(n) {
	if (n == null) return '#8a96a3';
	if (n >= 80) return '#2e9d4f';
	if (n >= 60) return '#7cab1f';
	if (n >= 40) return '#d6a218';
	return '#d0542c';
}

/** Selo SVG no estilo "flat", sem serviço externo. */
export function selo(rotulo, valor, cor) {
	const lw = largura(rotulo) + 12, vw = largura(valor) + 12, w = lw + vw;
	const r = escHtml(rotulo), v = escHtml(valor);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${r}: ${v}">
<title>${r}: ${v}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="c"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#c)"><rect width="${lw}" height="20" fill="#3b4a5a"/><rect x="${lw}" width="${vw}" height="20" fill="${cor}"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${r}</text><text x="${lw + vw / 2}" y="14">${v}</text></g>
</svg>
`;
}
