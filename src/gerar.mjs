import { escHtml, escMd, hoje, PROJETO_URL } from './util.mjs';

const curto = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** Perfis públicos que entram em sameAs (sem vazios e sem repetição). */
export function sameAs(perfil) {
	const urls = [perfil.github_url, perfil.links.linkedin, perfil.links.instagram, perfil.links.google_negocio, ...perfil.links.outros];
	return [...new Set(urls.filter(Boolean))];
}

function endereco(perfil) {
	if (!(perfil.cidade || perfil.estado || perfil.pais || perfil.endereco)) return null;
	const a = { '@type': 'PostalAddress' };
	if (perfil.endereco) a.streetAddress = perfil.endereco;
	if (perfil.cidade) a.addressLocality = perfil.cidade;
	if (perfil.estado) a.addressRegion = perfil.estado;
	if (perfil.cep) a.postalCode = perfil.cep;
	if (perfil.pais) a.addressCountry = perfil.pais;
	return a;
}

/** schema.org Person. */
export function pessoaJsonLd(perfil, { id } = {}) {
	const base = perfil.site || perfil.github_url;
	const pessoa = {
		'@type': 'Person',
		'@id': id || `${base.replace(/\/?$/, '/')}#pessoa`,
		name: perfil.nome,
		jobTitle: perfil.titulo,
		url: base,
		sameAs: sameAs(perfil)
	};
	if (perfil.usuario_github) pessoa.image = `https://github.com/${perfil.usuario_github}.png`;
	if (perfil.apelidos.length) pessoa.alternateName = perfil.apelidos;
	if (perfil.sobre) pessoa.description = perfil.sobre;
	const end = endereco(perfil);
	if (end) pessoa.address = end;
	if (perfil.empresa.nome) {
		pessoa.worksFor = { '@type': 'Organization', name: perfil.empresa.nome };
		if (perfil.empresa.site) pessoa.worksFor.url = perfil.empresa.site;
	}
	if (perfil.especialidades.length) pessoa.knowsAbout = perfil.especialidades;
	if (perfil.idiomas.length) pessoa.knowsLanguage = perfil.idiomas;
	return pessoa;
}

/** schema.org Organization ou LocalBusiness (quando atende em endereço físico). */
export function organizacaoJsonLd(perfil) {
	const org = {
		'@type': perfil.negocio_local ? 'LocalBusiness' : 'Organization',
		'@id': `${perfil.site.replace(/\/?$/, '/')}#organizacao`,
		name: perfil.nome,
		url: perfil.site,
		sameAs: sameAs(perfil)
	};
	if (perfil.nome_legal) org.legalName = perfil.nome_legal;
	if (perfil.apelidos.length) org.alternateName = perfil.apelidos;
	if (perfil.sobre || perfil.titulo) org.description = perfil.sobre || perfil.titulo;
	if (perfil.logo) org.logo = perfil.logo;
	if (perfil.negocio_local && perfil.logo) org.image = perfil.logo;
	const end = endereco(perfil);
	if (end) org.address = end;
	if (perfil.telefone) org.telephone = perfil.telefone;
	if (perfil.email_publico) org.email = perfil.email_publico;
	if (perfil.cidade) org.areaServed = perfil.cidade;
	if (perfil.especialidades.length) org.knowsAbout = perfil.especialidades;
	return org;
}

export function entidadeJsonLd(perfil) {
	return perfil.tipo === 'empresa' ? organizacaoJsonLd(perfil) : pessoaJsonLd(perfil);
}

/** Dados estruturados da página gerada: ProfilePage (pessoa) ou a própria organização (empresa). */
export function profilePageJsonLd(perfil, data = hoje()) {
	if (perfil.tipo === 'empresa') return { '@context': 'https://schema.org', ...organizacaoJsonLd(perfil) };
	return { '@context': 'https://schema.org', '@type': 'ProfilePage', dateModified: data, mainEntity: pessoaJsonLd(perfil) };
}

/** Trecho para colar no <head> do site. */
export function snippetSite(perfil) {
	const onde = perfil.tipo === 'empresa' ? 'da página inicial' : 'da página "sobre"';
	return `<!-- Eu na IA: cole este bloco no <head> ${onde} do seu site -->
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', ...entidadeJsonLd(perfil) }, null, 2)}
</script>
`;
}

export function llmsTxt(perfil) {
	const emp = perfil.tipo === 'empresa';
	const l = [`# ${perfil.nome}`, '', `> ${perfil.titulo}${perfil.local ? ` em ${perfil.local}` : ''}.`, ''];
	if (perfil.sobre) l.push(perfil.sobre, '');
	if (perfil.especialidades.length) l.push(`${emp ? 'Serviços' : 'Especialidades'}: ${perfil.especialidades.join(', ')}.`, '');
	if (emp && (perfil.telefone || perfil.email_publico)) l.push(`Contato: ${[perfil.telefone, perfil.email_publico].filter(Boolean).join(' · ')}.`, '');
	l.push(emp ? '## Canais oficiais' : '## Perfis', '');
	if (perfil.site) l.push(`- [Site](${perfil.site}): site ${emp ? 'oficial' : 'principal'}`);
	if (perfil.github_url) l.push(`- [GitHub](${perfil.github_url}): ${emp ? 'código aberto' : 'repositórios e contribuições'}`);
	if (!emp && perfil.empresa.nome && perfil.empresa.site && perfil.empresa.site !== perfil.site) l.push(`- [${perfil.empresa.nome}](${perfil.empresa.site}): empresa`);
	if (perfil.links.linkedin) l.push(`- [LinkedIn](${perfil.links.linkedin})`);
	if (perfil.links.instagram) l.push(`- [Instagram](${perfil.links.instagram})`);
	if (perfil.links.google_negocio) l.push(`- [Perfil no Google](${perfil.links.google_negocio})`);
	perfil.links.outros.forEach((u) => l.push(`- [${curto(u)}](${u})`));
	if (perfil.projetos_destaque.length) {
		l.push('', '## Projetos', '');
		perfil.projetos_destaque.forEach((p) => l.push(`- [${p.nome}](${p.url})${p.descricao ? `: ${p.descricao}` : ''}`));
	}
	return l.join('\n') + '\n';
}

function linksMd(perfil, paginaUrl) {
	const links = [];
	if (perfil.site) links.push(`[Site](${perfil.site})`);
	if (perfil.links.linkedin) links.push(`[LinkedIn](${perfil.links.linkedin})`);
	if (perfil.links.instagram) links.push(`[Instagram](${perfil.links.instagram})`);
	if (perfil.links.google_negocio) links.push(`[Google](${perfil.links.google_negocio})`);
	if (perfil.tipo === 'empresa' && perfil.github_url) links.push(`[GitHub](${perfil.github_url})`);
	perfil.links.outros.forEach((u) => links.push(`[${curto(u)}](${u})`));
	if (paginaUrl) links.push(`[Página pessoal](${paginaUrl})`);
	return links;
}

const LIVRE = /<!--\s*livre:inicio\s*-->([\s\S]*?)<!--\s*livre:fim\s*-->/;

/** README (perfil do GitHub) ou resumo da empresa. Preserva o trecho entre livre:inicio e livre:fim. */
export function readmePerfil(perfil, { anterior = '', resumo = null, data = hoje(), paginaUrl = '' } = {}) {
	const emp = perfil.tipo === 'empresa';
	const livre = (anterior.match(LIVRE) || [])[1] ?? '\n<!-- Escreva aqui o que quiser. Este trecho é preservado a cada atualização. -->\n';
	const l = [`# ${perfil.nome}`, ''];
	l.push(`**${perfil.titulo}**${perfil.local ? ` · ${perfil.local}` : ''}`, '');
	if (perfil.sobre) l.push(perfil.sobre, '');
	if (perfil.especialidades.length) {
		if (emp) l.push('## Serviços', '', ...perfil.especialidades.map((e) => `- ${escMd(e)}`), '');
		else l.push(perfil.especialidades.map((e) => `\`${e}\``).join(' '), '');
	}
	l.push('<!-- livre:inicio -->' + livre + '<!-- livre:fim -->', '');
	if (perfil.projetos_destaque.length) {
		l.push('## Projetos em destaque', '');
		perfil.projetos_destaque.forEach((p) => {
			const nome = p.url ? `[**${escMd(p.nome)}**](${p.url})` : `**${escMd(p.nome)}**`;
			l.push(`- ${nome}${p.descricao ? ` — ${escMd(p.descricao)}` : ''}`);
		});
		l.push('');
	}
	const links = linksMd(perfil, emp ? '' : paginaUrl);
	if (links.length) l.push(emp ? '## Canais oficiais' : '## Onde me encontrar', '', links.join(' · '), '');
	if (resumo) l.push(`[![Presença](site/selos/presenca.svg)](relatorio/CHECKUP.md) [![Citado pelas IAs](site/selos/ia.svg)](relatorio/CHECKUP.md)`, '');
	l.push(`<sub>Atualizado em ${data} com o [Eu na IA](${PROJETO_URL}), check-up de presença ${emp ? 'para empresas e devs' : 'profissional para devs'}.</sub>`, '');
	return l.join('\n');
}

/** Página estática com os dados estruturados. */
export function paginaHtml(perfil, { data = hoje(), resumo = null } = {}) {
	const emp = perfil.tipo === 'empresa';
	const ld = JSON.stringify(profilePageJsonLd(perfil, data), null, 2).replace(/</g, '\\u003c');
	const titulo = `${perfil.nome} — ${perfil.titulo}`;
	const imagem = emp ? perfil.logo : perfil.usuario_github ? `https://github.com/${perfil.usuario_github}.png` : '';
	const projetos = perfil.projetos_destaque.map((p) => `<li><a href="${escHtml(p.url)}">${escHtml(p.nome)}</a>${p.descricao ? `<span>${escHtml(p.descricao)}</span>` : ''}</li>`).join('\n');
	const links = [['Site', perfil.site], ['GitHub', perfil.github_url], ['LinkedIn', perfil.links.linkedin], ['Instagram', perfil.links.instagram], ['Google', perfil.links.google_negocio], ...perfil.links.outros.map((u) => [curto(u), u])]
		.filter(([, u]) => u)
		.map(([n, u]) => `<a href="${escHtml(u)}" rel="me">${escHtml(n)}</a>`)
		.join('\n');
	const contato = emp && (perfil.telefone || perfil.email_publico || perfil.endereco)
		? `<h2>Contato</h2>\n<p class="sobre">${[perfil.endereco && `${escHtml(perfil.endereco)}${perfil.local ? `, ${escHtml(perfil.local)}` : ''}`, perfil.telefone && escHtml(perfil.telefone), perfil.email_publico && `<a href="mailto:${escHtml(perfil.email_publico)}">${escHtml(perfil.email_publico)}</a>`].filter(Boolean).join('<br>')}</p>`
		: '';
	const selos = resumo ? `<p class="selos"><img src="selos/presenca.svg" alt="Presença"> <img src="selos/ia.svg" alt="Citado pelas IAs"></p>` : '';
	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(titulo)}</title>
<meta name="description" content="${escHtml(perfil.sobre || titulo)}">
<link rel="canonical" href="${escHtml(perfil.site || perfil.github_url)}">
<link rel="alternate" type="text/plain" href="llms.txt" title="Resumo para modelos de linguagem">
<meta property="og:type" content="${emp ? 'website' : 'profile'}">
<meta property="og:title" content="${escHtml(titulo)}">
<meta property="og:description" content="${escHtml(perfil.sobre || titulo)}">
${imagem ? `<meta property="og:image" content="${escHtml(imagem)}">` : ''}
<script type="application/ld+json">
${ld}
</script>
<style>
:root{--bg:#fbfaf7;--ink:#17202a;--soft:#5b6773;--line:#e3e0d8;--accent:#1f6f5c;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#12171c;--ink:#e9eef2;--soft:#9aa6b1;--line:#26303a;--accent:#7fd1b9;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 Georgia,"Iowan Old Style","Times New Roman",serif}
main{max-width:680px;margin:0 auto;padding:72px 24px 56px}
img.avatar{width:88px;height:88px;border-radius:${emp ? '12px' : '50%'};object-fit:contain;display:block;margin-bottom:24px}
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
${imagem ? `<img class="avatar" src="${escHtml(imagem)}" alt="${emp ? 'Logo' : 'Foto'} de ${escHtml(perfil.nome)}" width="88" height="88">` : ''}
<h1>${escHtml(perfil.nome)}</h1>
<p class="titulo">${escHtml(perfil.titulo)}${perfil.local ? ` · ${escHtml(perfil.local)}` : ''}</p>
${perfil.sobre ? `<p class="sobre">${escHtml(perfil.sobre)}</p>` : ''}
${perfil.especialidades.length ? `<ul class="tags">${perfil.especialidades.map((e) => `<li>${escHtml(e)}</li>`).join('')}</ul>` : ''}
${projetos ? `<h2>Projetos</h2>\n<ul class="proj">\n${projetos}\n</ul>` : ''}
${contato}
<h2>${emp ? 'Canais oficiais' : 'Onde me encontrar'}</h2>
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
