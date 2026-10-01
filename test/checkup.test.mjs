import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

import { validarPerfil, termosDe, ErroPerfil } from '../src/perfil.mjs';
import { profilePageJsonLd, llmsTxt, readmePerfil, paginaHtml, snippetSite } from '../src/gerar.mjs';
import { auditar, extrairJsonLd, robosBloqueados, notaPresenca } from '../src/auditar.mjs';
import { analisarResposta } from '../src/match.mjs';
import { medir, montarPerguntas, motoresAtivos } from '../src/medir.mjs';
import * as anthropic from '../src/engines/anthropic.mjs';
import * as openai from '../src/engines/openai.mjs';
import * as gemini from '../src/engines/gemini.mjs';
import * as perplexity from '../src/engines/perplexity.mjs';
import { selo } from '../src/badge.mjs';
import { executar, destinoReadme, urlPages } from '../src/cli.mjs';

const BRUTO = {
	nome: 'Maria Souza',
	apelidos: ['Mari Souza'],
	usuario_github: 'mariasouza',
	titulo: 'Desenvolvedora backend Python',
	cidade: 'Recife', estado: 'PE', pais: 'Brasil',
	sobre: 'Desenvolvo APIs em Python.',
	especialidades: ['Python', 'Django'],
	idiomas: ['Português'],
	site: 'https://mariasouza.dev',
	empresa: { nome: 'Acme', site: 'https://acme.com.br' },
	links: { linkedin: 'https://www.linkedin.com/in/mariasouza', outros: [] },
	projetos_destaque: [{ nome: 'filas', repo: 'mariasouza/filas', descricao: 'Filas em Python' }],
	medicao: { motores: ['anthropic', 'openai', 'gemini', 'perplexity'], perguntas: ['Quem é {nome}?', 'Devs de {especialidade} em {cidade}?', 'Quem criou {projeto}?', 'Sobre {inexistente}'] },
	publicar_pages: true
};
const perfil = () => validarPerfil(structuredClone(BRUTO));

/* ---------- fetch simulado ---------- */
function resp(status, corpo, tipo = 'json') {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => (tipo === 'json' ? corpo : JSON.parse(corpo)),
		text: async () => (tipo === 'json' ? JSON.stringify(corpo) : corpo)
	};
}

const SITE_BOM = `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, { '@type': 'Person', name: 'Maria Souza', sameAs: ['https://github.com/mariasouza'] }] })}</script></head></html>`;

function fakeFetch({ site = SITE_BOM, robots = 'User-agent: *\nDisallow: /admin\n', llms = '# Maria Souza\n', ia = {} } = {}) {
	const chamadas = [];
	const f = async (url, opts = {}) => {
		chamadas.push(url);
		const u = String(url);
		if (u === 'https://api.github.com/users/mariasouza') return resp(200, { name: 'Maria Souza', bio: 'Backend Python', location: 'Recife, PE', blog: 'mariasouza.dev' });
		if (u === 'https://api.github.com/repos/mariasouza/mariasouza') return resp(404, {});
		if (u === 'https://api.github.com/repos/mariasouza/filas') return resp(200, { description: 'Filas', homepage: '', topics: ['python'], license: { key: 'mit' } });
		if (u === 'https://api.github.com/graphql') return resp(200, { data: { user: { pinnedItems: { totalCount: 2 } } } });
		if (u === 'https://mariasouza.dev/') return resp(200, site, 'text');
		if (u === 'https://mariasouza.dev/robots.txt') return robots == null ? resp(404, '', 'text') : resp(200, robots, 'text');
		if (u === 'https://mariasouza.dev/llms.txt') return llms == null ? resp(404, '', 'text') : resp(200, llms, 'text');
		if (u.startsWith('https://api.anthropic.com')) return resp(200, ia.anthropic || { content: [{ type: 'text', text: 'Maria Souza é dev em Recife.', citations: [{ url: 'https://github.com/mariasouza' }] }] });
		if (u.startsWith('https://api.openai.com')) return resp(200, ia.openai || { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Não encontrei ninguém.', annotations: [] }] }] });
		if (u.startsWith('https://generativelanguage')) return resp(500, { error: { message: 'quota' } });
		if (u.startsWith('https://api.perplexity.ai')) return resp(200, { choices: [{ message: { content: 'Veja mariasouza.dev' } }], citations: ['https://mariasouza.dev/sobre'] });
		return resp(404, {});
	};
	f.chamadas = chamadas;
	return f;
}

/* ---------- perfil ---------- */
test('perfil: valida e normaliza', () => {
	const p = perfil();
	assert.equal(p.github_url, 'https://github.com/mariasouza');
	assert.equal(p.local, 'Recife, PE, Brasil');
	assert.equal(p.projetos_destaque[0].url, 'https://github.com/mariasouza/filas');
	assert.deepEqual(termosDe(p).dominios, ['mariasouza.dev', 'acme.com.br']);
});

test('perfil: aponta todos os erros de uma vez', () => {
	assert.throws(() => validarPerfil({ site: 'mariasouza.dev', medicao: { motores: ['bard'] } }), (e) => {
		assert.ok(e instanceof ErroPerfil);
		for (const t of ['"nome"', '"usuario_github"', '"titulo"', '"site"', 'bard']) assert.ok(e.message.includes(t), t);
		return true;
	});
});

test('perfil.yml de exemplo do repositório é válido', async () => {
	const p = validarPerfil(YAML.parse(await readFile(new URL('../perfil.yml', import.meta.url), 'utf8')));
	assert.ok(p.nome && p.usuario_github && p.medicao.perguntas.length);
});

/* ---------- geração ---------- */
test('JSON-LD: ProfilePage com Person e sameAs', () => {
	const d = profilePageJsonLd(perfil(), '2026-10-01');
	assert.equal(d['@type'], 'ProfilePage');
	assert.equal(d.mainEntity['@type'], 'Person');
	assert.deepEqual(d.mainEntity.sameAs, ['https://github.com/mariasouza', 'https://www.linkedin.com/in/mariasouza']);
	assert.equal(d.mainEntity.address.addressLocality, 'Recife');
	assert.equal(d.mainEntity.worksFor.name, 'Acme');
});

test('página e snippet contêm JSON-LD válido e são lidos pela própria auditoria', () => {
	const html = paginaHtml(perfil(), { data: '2026-10-01' });
	const objs = extrairJsonLd(html);
	assert.ok(objs.some((o) => o['@type'] === 'ProfilePage'));
	assert.ok(objs.some((o) => o['@type'] === 'Person' && o.name === 'Maria Souza'));
	assert.ok(extrairJsonLd(snippetSite(perfil())).some((o) => o['@type'] === 'Person'));
});

test('página escapa HTML do usuário', () => {
	const p = validarPerfil({ ...structuredClone(BRUTO), sobre: '<script>alert(1)</script>', nome: 'A </script> B' });
	const html = paginaHtml(p);
	assert.ok(!html.includes('<script>alert(1)</script>'));
	assert.equal(extrairJsonLd(html).find((o) => o['@type'] === 'Person').name, 'A </script> B');
});

test('llms.txt começa com H1 e lista perfis e projetos', () => {
	const t = llmsTxt(perfil());
	assert.match(t, /^# Maria Souza\n/);
	assert.ok(t.includes('[GitHub](https://github.com/mariasouza)'));
	assert.ok(t.includes('## Projetos'));
});

test('README preserva o bloco livre entre atualizações', () => {
	const r1 = readmePerfil(perfil(), { data: '2026-10-01' });
	const editado = r1.replace(/<!-- livre:inicio -->[\s\S]*?<!-- livre:fim -->/, '<!-- livre:inicio -->\nMeu texto\n<!-- livre:fim -->');
	const r2 = readmePerfil(perfil(), { anterior: editado, data: '2026-11-01' });
	assert.ok(r2.includes('Meu texto'));
	assert.ok(r2.includes('2026-11-01'));
});

test('selo SVG bem formado e escapado', () => {
	const s = selo('presença', '80/100 <b>', '#2e9d4f');
	assert.match(s, /^<svg[\s\S]*<\/svg>\n$/);
	assert.ok(s.includes('&lt;b&gt;'));
});

/* ---------- auditoria ---------- */
test('robots.txt: grupos, curinga e precedência do grupo específico', () => {
	assert.deepEqual(robosBloqueados('User-agent: *\nDisallow: /'), ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended']);
	assert.deepEqual(robosBloqueados('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /'), ['GPTBot']);
	assert.deepEqual(robosBloqueados('User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /').includes('ClaudeBot'), false);
	assert.deepEqual(robosBloqueados('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /'), ['GPTBot', 'ClaudeBot']);
	assert.deepEqual(robosBloqueados('User-agent: *\nDisallow: /wp-admin/'), []);
});

test('auditoria completa com dados simulados', async () => {
	const { itens, nota } = await auditar(perfil(), { token: 't', fetchImpl: fakeFetch() });
	const st = Object.fromEntries(itens.map((i) => [i.id, i.status]));
	assert.equal(st.gh_nome, 'ok');
	assert.equal(st.gh_site, 'ok');
	assert.equal(st.gh_readme, 'falha');
	assert.equal(st.gh_fixados, 'atencao');
	assert.equal(st['repo:mariasouza/filas'], 'falha'); // sem homepage e com 1 tópico
	assert.equal(st.site_person, 'ok');
	assert.equal(st.site_sameas, 'ok');
	assert.equal(st.robots_ia, 'ok');
	assert.equal(st.llms_txt, 'ok');
	assert.ok(nota > 0 && nota < 100);
});

test('auditoria: site sem JSON-LD e robots bloqueando IAs', async () => {
	const { itens } = await auditar(perfil(), { fetchImpl: fakeFetch({ site: '<html></html>', robots: 'User-agent: GPTBot\nDisallow: /', llms: null }) });
	const st = Object.fromEntries(itens.map((i) => [i.id, i]));
	assert.equal(st.site_person.status, 'falha');
	assert.equal(st.robots_ia.status, 'falha');
	assert.ok(st.robots_ia.detalhe.includes('GPTBot'));
	assert.equal(st.llms_txt.status, 'atencao');
	assert.equal(st.gh_fixados.status, 'pulado'); // sem token
});

test('auditoria: site com proteção anti-robô não vira falsa reprovação', async () => {
	const base = fakeFetch();
	const f = async (url, o) => (String(url).startsWith('https://mariasouza.dev') ? resp(403, 'Forbidden', 'text') : base(url, o));
	const { itens } = await auditar(perfil(), { fetchImpl: f });
	const st = Object.fromEntries(itens.map((i) => [i.id, i]));
	assert.equal(st.site_ok.status, 'atencao');
	assert.ok(st.site_ok.comoCorrigir.includes('GPTBot'));
	assert.equal(st.robots_ia.status, 'pulado');
	assert.equal(st.llms_txt.status, 'pulado');
});

test('auditoria: falha de rede vira "pulado", não derruba', async () => {
	const boom = async () => { throw new Error('rede caiu'); };
	const { itens, nota } = await auditar(perfil(), { fetchImpl: boom });
	assert.ok(itens.length > 0);
	assert.ok(itens.some((i) => i.status === 'pulado'));
	assert.ok(nota === null || typeof nota === 'number');
});

test('nota ponderada pela evidência', () => {
	assert.equal(notaPresenca([{ evidencia: 'comprovado', status: 'ok' }, { evidencia: 'aposta', status: 'falha' }]), 75);
	assert.equal(notaPresenca([{ evidencia: 'provavel', status: 'pulado' }]), null);
});

/* ---------- menções e motores ---------- */
test('menções: nome sem acento, usuário e domínio; evita falso positivo', () => {
	const t = termosDe(perfil());
	assert.equal(analisarResposta({ texto: 'Conheça MARIA SOUZA, de Recife.', urls: [] }, t).mencionado, true);
	assert.equal(analisarResposta({ texto: 'Veja @mariasouza no GitHub', urls: [] }, t).mencionado, true);
	assert.equal(analisarResposta({ texto: 'Ana Maria Souzanova', urls: [] }, t).mencionado, false);
	const r = analisarResposta({ texto: 'nada', urls: ['https://www.mariasouza.dev/x', 'https://github.com/outra', 'https://github.com/mariasouza/filas'] }, t);
	assert.equal(r.mencionado, false);
	assert.deepEqual(r.citacoes, ['https://www.mariasouza.dev/x', 'https://github.com/mariasouza/filas']);
});

test('menção com acento no nome', () => {
	const t = { nomes: ['João Cabral'], usuario: 'qartt', dominios: [] };
	const r = analisarResposta({ texto: 'O desenvolvedor Joao Cabral criou o GeoSim.', urls: [] }, t);
	assert.equal(r.mencionado, true);
	assert.ok(r.trecho.includes('Joao Cabral'));
});

test('extratores dos quatro motores', () => {
	assert.deepEqual(anthropic.extrair({ content: [{ type: 'server_tool_use' }, { type: 'web_search_tool_result', content: [{ url: 'https://a.com' }] }, { type: 'text', text: 'Oi ', citations: [{ url: 'https://b.com' }] }, { type: 'text', text: 'Maria' }] }), { texto: 'Oi Maria', urls: ['https://a.com', 'https://b.com'] });
	assert.deepEqual(openai.extrair({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: 'Olá', annotations: [{ type: 'url_citation', url: 'https://c.com' }] }] }] }), { texto: 'Olá', urls: ['https://c.com'] });
	assert.deepEqual(gemini.extrair({ candidates: [{ content: { parts: [{ text: 'A' }, { text: 'B' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/x', title: 'mariasouza.dev' } }] } }] }), { texto: 'AB', urls: ['https://mariasouza.dev'] });
	assert.deepEqual(perplexity.extrair({ choices: [{ message: { content: 'X' } }], citations: ['https://d.com'], search_results: [{ url: 'https://d.com' }, { url: 'https://e.com' }] }), { texto: 'X', urls: ['https://d.com', 'https://e.com'] });
});

test('perguntas: preenche variáveis e descarta as que não fecham', () => {
	assert.deepEqual(montarPerguntas(perfil()), ['Quem é Maria Souza?', 'Devs de Python em Recife?', 'Quem criou filas?']);
});

test('medição: só motores com chave; erro de um motor não derruba os outros', async () => {
	const env = { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'b', GEMINI_API_KEY: 'c', PERPLEXITY_API_KEY: 'd' };
	assert.deepEqual(motoresAtivos(perfil(), { OPENAI_API_KEY: 'x' }), ['openai']);
	const m = await medir(perfil(), { env, fetchImpl: fakeFetch() });
	assert.equal(m.resultados.length, 12);
	assert.equal(m.resultados.filter((r) => r.erro).length, 3); // gemini com erro
	// anthropic (3 menções) + perplexity (3 menções por domínio) de 9 válidos
	assert.equal(m.taxa, Math.round((6 / 9) * 100));
	assert.ok(m.resultados.find((r) => r.motor === 'gemini').erro.includes('quota'));
});

/* ---------- ponta a ponta ---------- */
test('cli: destino do README e URL do Pages', () => {
	assert.equal(destinoReadme('mariasouza/mariasouza', 'mariasouza'), 'README.md');
	assert.equal(destinoReadme('MariaSouza/mariasouza', 'mariasouza'), 'README.md');
	assert.equal(destinoReadme('qartt/eu-na-ia', 'qartt'), 'PERFIL.md');
	assert.equal(destinoReadme('', 'x'), 'PERFIL.md');
	assert.equal(urlPages('mariasouza/mariasouza'), 'https://mariasouza.github.io/mariasouza/');
	assert.equal(urlPages('mariasouza/mariasouza.github.io'), 'https://mariasouza.github.io/');
});

test('cli: execução completa gera todos os arquivos e o histórico é por usuário', async () => {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'eunaia-'));
	await writeFile(path.join(dir, 'perfil.yml'), YAML.stringify(BRUTO));
	await mkdir(path.join(dir, 'relatorio'));
	await writeFile(path.join(dir, 'relatorio', 'historico.json'), JSON.stringify([{ data: '2026-09-01', usuario: 'outra', presenca: 10, ia: 10 }]));
	await writeFile(path.join(dir, 'README.md'), '# Documentação do template');
	await writeFile(path.join(dir, 'PERFIL.md'), 'sobra do exemplo');
	const out = path.join(dir, 'gh_output');
	const env = { GITHUB_REPOSITORY: 'mariasouza/mariasouza', GITHUB_TOKEN: 't', ANTHROPIC_API_KEY: 'k', GITHUB_OUTPUT: out };
	const r = await executar({ dir, env, fetchImpl: fakeFetch(), data: '2026-10-01', log: () => {} });

	assert.equal(r.destino, 'README.md');
	const readme = await readFile(path.join(dir, 'README.md'), 'utf8');
	assert.ok(readme.startsWith('# Maria Souza'));
	assert.ok(readme.includes('site/selos/presenca.svg'));
	assert.ok(readme.includes('https://mariasouza.github.io/mariasouza/'));
	assert.ok(!existsSync(path.join(dir, 'PERFIL.md')));
	for (const f of ['site/index.html', 'site/llms.txt', 'site/perfil.jsonld', 'site/snippet-jsonld.html', 'site/gerador.html', 'site/selos/presenca.svg', 'site/selos/ia.svg', 'relatorio/CHECKUP.md']) {
		assert.ok(existsSync(path.join(dir, f)), f);
	}
	JSON.parse(await readFile(path.join(dir, 'site/perfil.jsonld'), 'utf8'));
	const hist = JSON.parse(await readFile(path.join(dir, 'relatorio/historico.json'), 'utf8'));
	assert.deepEqual(hist.map((h) => h.usuario), ['mariasouza']);
	assert.equal(hist[0].ia, 100);
	const checkup = await readFile(path.join(dir, 'relatorio/CHECKUP.md'), 'utf8');
	assert.ok(checkup.includes('O que fazer primeiro'));
	assert.ok(checkup.includes('O que as IAs responderam'));
	assert.equal(await readFile(out, 'utf8'), 'publicar=true\n');

	// segunda execução no mesmo dia substitui a entrada sem apagar a medição; meses sem chave mantêm o último % no selo
	await executar({ dir, env: { GITHUB_REPOSITORY: 'mariasouza/mariasouza' }, fetchImpl: fakeFetch(), data: '2026-10-01', log: () => {} });
	const hist2 = JSON.parse(await readFile(path.join(dir, 'relatorio/historico.json'), 'utf8'));
	assert.equal(hist2.length, 1);
	assert.equal(hist2[0].ia, 100);
	await executar({ dir, env: { GITHUB_REPOSITORY: 'mariasouza/mariasouza' }, fetchImpl: fakeFetch(), data: '2026-11-01', log: () => {} });
	const svg = await readFile(path.join(dir, 'site/selos/ia.svg'), 'utf8');
	assert.ok(svg.includes('100%'), 'selo mantém a última medição');
	const hist3 = JSON.parse(await readFile(path.join(dir, 'relatorio/historico.json'), 'utf8'));
	assert.deepEqual(hist3.map((h) => [h.data, h.ia]), [['2026-10-01', 100], ['2026-11-01', null]]);
});

/* ---------- modo empresa ---------- */
const EMPRESA = {
	tipo: 'empresa',
	nome: 'Padaria Boa Massa',
	apelidos: ['Boa Massa'],
	segmento: 'Padaria artesanal',
	descricao: 'Pães de fermentação natural no Sion.',
	servicos: ['Pão de fermentação natural', 'Café da manhã'],
	site: 'https://boamassa.com.br',
	cidade: 'Belo Horizonte', estado: 'MG', pais: 'Brasil',
	negocio_local: true,
	endereco: 'Rua das Flores, 100',
	telefone: '+55 31 3333-4444',
	links: { instagram: 'https://instagram.com/boamassa', google_negocio: 'https://maps.app.goo.gl/abc', linkedin: '' },
	concorrentes: [{ nome: 'Pão Dourado', site: 'https://paodourado.com.br' }, 'Forno Real'],
	medicao: { motores: ['anthropic'], perguntas: ['Melhores lugares para {servico} em {cidade}?', 'Qual {segmento} você recomenda em {cidade}?', 'Alternativas à {concorrente}?'] }
};
const empresa = () => validarPerfil(structuredClone(EMPRESA));

test('empresa: valida sem usuario_github e exige segmento e site', () => {
	const e = empresa();
	assert.equal(e.tipo, 'empresa');
	assert.equal(e.titulo, 'Padaria artesanal');
	assert.equal(e.id, 'empresa-padaria-boa-massa');
	assert.equal(e.github_url, '');
	assert.equal(e.publicar_pages, false);
	assert.deepEqual(e.concorrentes.map((c) => c.nome), ['Pão Dourado', 'Forno Real']);
	assert.throws(() => validarPerfil({ tipo: 'empresa', nome: 'X' }), (err) => err.message.includes('"segmento"') && err.message.includes('"site"'));
	assert.throws(() => validarPerfil({ tipo: 'loja', nome: 'X' }), /tipo/);
});

test('empresa: LocalBusiness com endereço, telefone e sameAs', () => {
	const ld = profilePageJsonLd(empresa());
	assert.equal(ld['@type'], 'LocalBusiness');
	assert.equal(ld.address.streetAddress, 'Rua das Flores, 100');
	assert.equal(ld.telephone, '+55 31 3333-4444');
	assert.deepEqual(ld.sameAs, ['https://instagram.com/boamassa', 'https://maps.app.goo.gl/abc']);
	const org = profilePageJsonLd(validarPerfil({ ...structuredClone(EMPRESA), negocio_local: false }));
	assert.equal(org['@type'], 'Organization');
	assert.ok(extrairJsonLd(snippetSite(empresa())).some((o) => o['@type'] === 'LocalBusiness'));
	assert.ok(llmsTxt(empresa()).includes('## Canais oficiais'));
	assert.ok(readmePerfil(empresa()).includes('## Serviços'));
});

test('empresa: perguntas com segmento em minúscula e concorrente', () => {
	assert.deepEqual(montarPerguntas(empresa()), ['Melhores lugares para Pão de fermentação natural em Belo Horizonte?', 'Qual padaria artesanal você recomenda em Belo Horizonte?', 'Alternativas à Pão Dourado?']);
});

function fakeEmpresa({ html, robots = 'User-agent: *\nAllow: /\nSitemap: https://boamassa.com.br/mapa.xml' } = {}) {
	return async (url) => {
		const u = String(url);
		if (u === 'https://boamassa.com.br/') return resp(200, html, 'text');
		if (u === 'https://boamassa.com.br/robots.txt') return resp(200, robots, 'text');
		if (u === 'https://boamassa.com.br/mapa.xml') return resp(200, '<urlset/>', 'text');
		if (u.startsWith('https://api.anthropic.com')) return resp(200, { content: [{ type: 'text', text: 'Recomendo a Pão Dourado e a Boa Massa. Veja paodourado.com.br.' }] });
		if (u.startsWith('https://api.github.com')) throw new Error('não deveria consultar o GitHub pessoal');
		return resp(404, '', 'text');
	};
}

test('empresa: auditoria do site (organização, sameAs parcial, título, descrição, telefone, sitemap, Google)', async () => {
	const ld = { '@context': 'https://schema.org', '@type': 'Bakery', name: 'Padaria Boa Massa', sameAs: ['https://instagram.com/boamassa'] };
	const html = `<html><head><title>Padaria Boa Massa | Pães artesanais</title><meta name="description" content="Padaria de fermentação natural no Sion, Belo Horizonte."><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>Ligue (31) 3333-4444</body></html>`;
	const { itens } = await auditar(empresa(), { fetchImpl: fakeEmpresa({ html }) });
	const st = Object.fromEntries(itens.map((i) => [i.id, i.status]));
	assert.equal(st.site_org, 'ok');
	assert.equal(st.site_sameas, 'atencao');    // falta o Google
	assert.equal(st.site_titulo, 'ok');
	assert.equal(st.site_descricao, 'ok');
	assert.equal(st.site_telefone, 'ok');
	assert.equal(st.sitemap, 'ok');
	assert.equal(st.google_negocio, 'ok');
	assert.equal(st.gh_nome, undefined);
});

test('empresa: site sem dados nem título reprova os itens certos', async () => {
	const { itens } = await auditar(empresa(), { fetchImpl: fakeEmpresa({ html: '<html><body>oi</body></html>', robots: 'User-agent: *\nDisallow: /privado' }) });
	const st = Object.fromEntries(itens.map((i) => [i.id, i.status]));
	assert.equal(st.site_org, 'falha');
	assert.equal(st.site_titulo, 'falha');
	assert.equal(st.site_descricao, 'falha');
	assert.equal(st.site_telefone, 'atencao');
	assert.equal(st.sitemap, 'falha');
});

test('empresa: medição compara com concorrentes', async () => {
	const m = await medir(empresa(), { env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeEmpresa({ html: '' }) });
	assert.equal(m.resultados.length, 3);
	assert.deepEqual(m.resultados[0].concorrentes, ['Pão Dourado']);
	assert.equal(m.taxa, 100);
	assert.deepEqual(m.participacao.map((x) => [x.nome, x.taxa]), [['Padaria Boa Massa', 100], ['Pão Dourado', 100], ['Forno Real', 0]]);
});

test('empresa: cli gera PERFIL.md mesmo em repositório dono/dono e relatório com concorrentes', async () => {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'eunaia-emp-'));
	await writeFile(path.join(dir, 'perfil.yml'), YAML.stringify(EMPRESA));
	const html = '<html><head><title>Boa Massa</title></head></html>';
	const r = await executar({ dir, env: { GITHUB_REPOSITORY: 'boamassa/boamassa', ANTHROPIC_API_KEY: 'k' }, fetchImpl: fakeEmpresa({ html }), data: '2026-10-01', log: () => {} });
	assert.equal(r.destino, 'PERFIL.md');
	const checkup = await readFile(path.join(dir, 'relatorio/CHECKUP.md'), 'utf8');
	assert.ok(checkup.includes('Presença da marca'));
	assert.ok(checkup.includes('Quem as IAs citaram'));
	assert.ok(checkup.includes('Concorrentes citados'));
	const hist = JSON.parse(await readFile(path.join(dir, 'relatorio/historico.json'), 'utf8'));
	assert.equal(hist[0].usuario, 'empresa-padaria-boa-massa');
	assert.ok(extrairJsonLd(await readFile(path.join(dir, 'site/index.html'), 'utf8')).some((o) => o['@type'] === 'LocalBusiness'));
});

test('exemplos/empresa.yml e exemplos/pessoa.yml são válidos', async () => {
	for (const f of ['../exemplos/empresa.yml', '../exemplos/pessoa.yml']) {
		validarPerfil(YAML.parse(await readFile(new URL(f, import.meta.url), 'utf8')));
	}
});
