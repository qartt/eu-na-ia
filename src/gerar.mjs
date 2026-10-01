import { escHtml, escMd, hoje, PROJETO_URL } from './util.mjs';

export function sameAs(perfil) {
	const urls = [perfil.github_url, perfil.links.linkedin, ...perfil.links.outros];
	return [...new Set(urls.filter(Boolean))];
}

/** Objeto schema.org Person. */
export function pessoaJsonLd(perfil, { id } = {}) {
	const base = perfil.site || perfil.github_url;
	const pessoa = {
		'@type': 'Person',
		'@id': id || `${base.replace(/\/?$/, '/')}#pessoa`,
		name: perfil.nome,
		jobTitle: perfil.titulo,
		url: base,
		image: `https://github.com/${perfil.usuario_github}.png`,
		sameAs: sameAs(perfil)
	};
	if (perfil.apelidos.length) pessoa.alternateName = perfil.apelidos;
	if (perfil.sobre) pessoa.description = perfil.sobre;
	if (perfil.cidade || perfil.estado || perfil.pais) {
		pessoa.address = { '@type': 'PostalAddress' };
		if (perfil.cidade) pessoa.address.addressLocality = perfil.cidade;
		if (perfil.estado) pessoa.address.addressRegion = perfil.estado;
		if (perfil.pais) pessoa.address.addressCountry = perfil.pais;
	}
	if (perfil.empresa.nome) {
		pessoa.worksFor = { '@type': 'Organization', name: perfil.empresa.nome };
		if (perfil.empresa.site) pessoa.worksFor.url = perfil.empresa.site;
	}
	if (perfil.especialidades.length) pessoa.knowsAbout = perfil.especialidades;
	if (perfil.idiomas.length) pessoa.knowsLanguage = perfil.idiomas;
	return pessoa;
}

/** ProfilePage (documentado pelo Google para páginas de perfil) com a pessoa como mainEntity. */
export function profilePageJsonLd(perfil, data = hoje()) {
	return {
		'@context': 'https://schema.org',
		'@type': 'ProfilePage',
		dateModified: data,
		mainEntity: pessoaJsonLd(perfil)
	};
}

/** Trecho para colar no <head> da página "sobre" do seu próprio site. */
export function snippetSite(perfil) {
	const obj = { '@context': 'https://schema.org', ...pessoaJsonLd(perfil) };
	return `<!-- Eu na IA: cole este bloco no <head> da página "sobre" do seu site -->
<script type="application/ld+json">
${JSON.stringify(obj, null, 2)}
</script>
`;
}

export function llmsTxt(perfil) {
	const linhas = [`# ${perfil.nome}`, '', `> ${perfil.titulo}${perfil.local ? ` em ${perfil.local}` : ''}.`, ''];
	if (perfil.sobre) linhas.push(perfil.sobre, '');
	if (perfil.especialidades.length) linhas.push(`Especialidades: ${perfil.especialidades.join(', ')}.`, '');
	linhas.push('## Perfis', '');
	linhas.push(`- [GitHub](${perfil.github_url}): repositórios e contribuições`);
	if (perfil.site) linhas.push(`- [Site](${perfil.site}): site principal`);
	if (perfil.empresa.nome && perfil.empresa.site && perfil.empresa.site !== perfil.site) linhas.push(`- [${perfil.empresa.nome}](${perfil.empresa.site}): empresa`);
	if (perfil.links.linkedin) linhas.push(`- [LinkedIn](${perfil.links.linkedin}): trajetória profissional`);
	perfil.links.outros.forEach((u) => linhas.push(`- [${u.replace(/^https?:\/\//, '')}](${u})`));
	if (perfil.projetos_destaque.length) {
		linhas.push('', '## Projetos', '');
		perfil.projetos_destaque.forEach((p) => linhas.push(`- [${p.nome}](${p.url})${p.descricao ? `: ${p.descricao}` : ''}`));
	}
	return linhas.join('\n') + '\n';
}

const LIVRE = /<!--\s*livre:inicio\s*-->([\s\S]*?)<!--\s*livre:fim\s*-->/;

/** README do perfil do GitHub. Preserva o que estiver entre os marcadores livre:inicio/livre:fim. */
export function readmePerfil(perfil, { anterior = '', resumo = null, data = hoje(), paginaUrl = '' } = {}) {
	const livre = (anterior.match(LIVRE) || [])[1] ?? '\n<!-- Escreva aqui o que quiser. Este trecho é preservado a cada atualização. -->\n';
	const l = [];
	l.push(`# ${perfil.nome}`, '');
	l.push(`**${perfil.titulo}**${perfil.local ? ` · ${perfil.local}` : ''}`, '');
	if (perfil.sobre) l.push(perfil.sobre, '');
	if (perfil.especialidades.length) l.push(perfil.especialidades.map((e) => `\`${e}\``).join(' '), '');
	l.push('<!-- livre:inicio -->' + livre + '<!-- livre:fim -->', '');
	if (perfil.projetos_destaque.length) {
		l.push('## Projetos em destaque', '');
		perfil.projetos_destaque.forEach((p) => {
			const nome = p.url ? `[**${escMd(p.nome)}**](${p.url})` : `**${escMd(p.nome)}**`;
			l.push(`- ${nome}${p.descricao ? ` — ${escMd(p.descricao)}` : ''}`);
		});
		l.push('');
	}
	const links = [];
	if (perfil.site) links.push(`[Site](${perfil.site})`);
	if (perfil.links.linkedin) links.push(`[LinkedIn](${perfil.links.linkedin})`);
	perfil.links.outros.forEach((u) => links.push(`[${u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}](${u})`));
	if (paginaUrl) links.push(`[Página pessoal](${paginaUrl})`);
	if (links.length) l.push('## Onde me encontrar', '', links.join(' · '), '');
	if (resumo) {
		l.push(`[![Presença profissional](site/selos/presenca.svg)](relatorio/CHECKUP.md) [![Citado pelas IAs](site/selos/ia.svg)](relatorio/CHECKUP.md)`, '');
	}
	l.push(`<sub>Atualizado em ${data} com o [Eu na IA](${PROJETO_URL}), check-up de presença profissional para devs.</sub>`, '');
	return l.join('\n');
}

/** Página pessoal estática com ProfilePage + Person. */
export function paginaHtml(perfil, { data = hoje(), resumo = null } = {}) {
	const ld = JSON.stringify(profilePageJsonLd(perfil, data), null, 2).replace(/</g, '\\u003c');
	const titulo = `${perfil.nome} — ${perfil.titulo}`;
	const projetos = perfil.projetos_destaque.map((p) => `<li><a href="${escHtml(p.url)}">${escHtml(p.nome)}</a>${p.descricao ? `<span>${escHtml(p.descricao)}</span>` : ''}</li>`).join('\n');
	const links = [['GitHub', perfil.github_url], ['Site', perfil.site], ['LinkedIn', perfil.links.linkedin], ...perfil.links.outros.map((u) => [u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), u])]
		.filter(([, u]) => u)
		.map(([n, u]) => `<a href="${escHtml(u)}" rel="me">${escHtml(n)}</a>`)
		.join('\n');
	const selos = resumo ? `<p class="selos"><img src="selos/presenca.svg" alt="Presença profissional"> <img src="selos/ia.svg" alt="Citado pelas IAs"></p>` : '';
	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(titulo)}</title>
<meta name="description" content="${escHtml(perfil.sobre || titulo)}">
<link rel="canonical" href="${escHtml(perfil.site || perfil.github_url)}">
<link rel="alternate" type="text/plain" href="llms.txt" title="Resumo para modelos de linguagem">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escHtml(titulo)}">
<meta property="og:description" content="${escHtml(perfil.sobre || titulo)}">
<meta property="og:image" content="https://github.com/${escHtml(perfil.usuario_github)}.png">
<script type="application/ld+json">
${ld}
</script>
<style>
:root{--bg:#fbfaf7;--ink:#17202a;--soft:#5b6773;--line:#e3e0d8;--accent:#1f6f5c;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#12171c;--ink:#e9eef2;--soft:#9aa6b1;--line:#26303a;--accent:#7fd1b9;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,"Iowan Old Style","Times New Roman",serif}
main{max-width:680px;margin:0 auto;padding:72px 24px 56px}
img.avatar{width:88px;height:88px;border-radius:50%;display:block;margin-bottom:24px}
h1{font-size:clamp(2rem,6vw,2.8rem);line-height:1.1;margin:0 0 8px;font-weight:700;letter-spacing:-.01em}
.titulo{font:600 1rem/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--accent);margin:0 0 28px}
.sobre{margin:0 0 28px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 40px;padding:0;list-style:none;font:500 .85rem system-ui,sans-serif}
.tags li{border:1px solid var(--line);border-radius:999px;padding:4px 12px;color:var(--soft)}
h2{font:700 .95rem system-ui,sans-serif;margin:40px 0 12px;color:var(--soft)}
ul.proj{list-style:none;padding:0;margin:0}
ul.proj li{padding:14px 0;border-top:1px solid var(--line)}
ul.proj a{font-weight:700;color:var(--ink)}
ul.proj span{display:block;color:var(--soft);font-size:.95rem}
nav.links{display:flex;flex-wrap:wrap;gap:8px 20px;font:500 .95rem system-ui,sans-serif}
a{color:var(--accent)}
.selos{margin:40px 0 0}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);font:.8rem system-ui,sans-serif;color:var(--soft)}
footer a{color:var(--soft)}
</style>
</head>
<body>
<main>
<img class="avatar" src="https://github.com/${escHtml(perfil.usuario_github)}.png" alt="Foto de ${escHtml(perfil.nome)}" width="88" height="88">
<h1>${escHtml(perfil.nome)}</h1>
<p class="titulo">${escHtml(perfil.titulo)}${perfil.local ? ` · ${escHtml(perfil.local)}` : ''}</p>
${perfil.sobre ? `<p class="sobre">${escHtml(perfil.sobre)}</p>` : ''}
${perfil.especialidades.length ? `<ul class="tags">${perfil.especialidades.map((e) => `<li>${escHtml(e)}</li>`).join('')}</ul>` : ''}
${projetos ? `<h2>Projetos</h2>\n<ul class="proj">\n${projetos}\n</ul>` : ''}
<h2>Onde me encontrar</h2>
<nav class="links">
${links}
</nav>
${selos}
<footer>Atualizado em ${data}. Página gerada pelo <a href="${PROJETO_URL}">Eu na IA</a> · <a href="gerador.html">crie a sua</a></footer>
</main>
</body>
</html>
`;
}
