#!/usr/bin/env node
import { mkdir, readFile, writeFile, copyFile, appendFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarPerfil, ErroPerfil } from './perfil.mjs';
import { readmePerfil, paginaHtml, snippetSite, llmsTxt, profilePageJsonLd } from './gerar.mjs';
import { auditar } from './auditar.mjs';
import { medir, motoresAtivos } from './medir.mjs';
import { checkupMd } from './relatorio.mjs';
import { selo, corPorNota } from './badge.mjs';
import { hoje } from './util.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function args(argv) {
	return { semAuditoria: argv.includes('--sem-auditoria'), semMedicao: argv.includes('--sem-medicao'), dir: (argv.find((a) => a.startsWith('--dir=')) || '').slice(6) || process.cwd() };
}

/** No repositório usuario/usuario o README vira o perfil; em qualquer outro, vai para PERFIL.md. */
export function destinoReadme(repositorio, usuario, tipo = 'pessoa') {
	if (!repositorio || !usuario || tipo === 'empresa') return 'PERFIL.md';
	const [dono, nome] = repositorio.split('/');
	return dono && nome && dono.toLowerCase() === nome.toLowerCase() && dono.toLowerCase() === usuario.toLowerCase() ? 'README.md' : 'PERFIL.md';
}

export function urlPages(repositorio) {
	if (!repositorio) return '';
	const [dono, nome] = repositorio.split('/');
	return nome.toLowerCase() === `${dono.toLowerCase()}.github.io` ? `https://${dono.toLowerCase()}.github.io/` : `https://${dono.toLowerCase()}.github.io/${nome}/`;
}

export async function executar({ dir = process.cwd(), env = process.env, fetchImpl = globalThis.fetch, semAuditoria = false, semMedicao = false, data = hoje(), log = console.log } = {}) {
	const perfil = await carregarPerfil(path.join(dir, 'perfil.yml'));
	log(`${perfil.tipo === 'empresa' ? 'Empresa' : 'Perfil'}: ${perfil.nome}${perfil.usuario_github ? ` (@${perfil.usuario_github})` : ''}`);

	let auditoria = null;
	if (!semAuditoria) {
		log('Auditando presença…');
		auditoria = await auditar(perfil, { token: env.GITHUB_TOKEN || '', fetchImpl });
		log(`  nota de presença: ${auditoria.nota ?? '—'}`);
	}

	let medicao = null;
	if (!semMedicao) {
		const ativos = motoresAtivos(perfil, env);
		if (ativos.length) {
			log(`Medindo em ${ativos.length} motor(es)…`);
			medicao = await medir(perfil, { env, fetchImpl, log });
			log(`  citado em ${medicao.taxa ?? '—'}% das respostas`);
		} else {
			log('Medição pulada: nenhuma chave de API configurada.');
		}
	}

	const relDir = path.join(dir, 'relatorio');
	const siteDir = path.join(dir, 'site');
	await mkdir(relDir, { recursive: true });
	await mkdir(path.join(siteDir, 'selos'), { recursive: true });

	// histórico (uma entrada por dia; a última do dia substitui)
	const histArq = path.join(relDir, 'historico.json');
	let historico = [];
	try { historico = JSON.parse(await readFile(histArq, 'utf8')); } catch { historico = []; }
	if (!Array.isArray(historico)) historico = [];
	// ignora histórico de outra pessoa (ex.: o exemplo que vem no template)
	historico = historico.filter((h) => h && h.usuario === perfil.id);
	const ultimoIa = [...historico].reverse().find((h) => h.ia != null)?.ia ?? null;
	const entrada = { data, usuario: perfil.id, presenca: auditoria?.nota ?? null, ia: medicao?.taxa ?? null };
	const mesmoDia = historico.find((h) => h.data === data);
	if (mesmoDia && entrada.ia == null) entrada.ia = mesmoDia.ia ?? null; // rodar de novo sem chave não apaga a medição do dia
	historico = historico.filter((h) => h.data !== data).concat(entrada);
	await writeFile(histArq, JSON.stringify(historico, null, 2) + '\n');

	const resumo = { presenca: entrada.presenca, ia: entrada.ia ?? ultimoIa };
	await writeFile(path.join(siteDir, 'selos', 'presenca.svg'), selo(perfil.tipo === 'empresa' ? 'presença da marca' : 'presença', resumo.presenca != null ? `${resumo.presenca}/100` : 'sem dados', corPorNota(resumo.presenca)));
	await writeFile(path.join(siteDir, 'selos', 'ia.svg'), selo('citado pelas IAs', resumo.ia != null ? `${resumo.ia}%` : 'sem medição', corPorNota(resumo.ia)));

	const repo = env.GITHUB_REPOSITORY || '';
	const pagina = perfil.publicar_pages ? urlPages(repo) : '';
	await writeFile(path.join(siteDir, 'index.html'), paginaHtml(perfil, { data, resumo }));
	await writeFile(path.join(siteDir, 'llms.txt'), llmsTxt(perfil));
	await writeFile(path.join(siteDir, 'perfil.jsonld'), JSON.stringify(profilePageJsonLd(perfil, data), null, 2) + '\n');
	await writeFile(path.join(siteDir, 'snippet-jsonld.html'), snippetSite(perfil));
	await writeFile(path.join(siteDir, '.nojekyll'), '');
	const gerador = path.join(RAIZ, 'templates', 'gerador.html');
	if (existsSync(gerador)) await copyFile(gerador, path.join(siteDir, 'gerador.html'));

	const destino = destinoReadme(repo, perfil.usuario_github, perfil.tipo);
	const readmeArq = path.join(dir, destino);
	let anterior = '';
	try { anterior = await readFile(readmeArq, 'utf8'); } catch { /* novo */ }
	// No primeiro uso, o README do template (documentação) não tem marcadores e é substituído pelo perfil.
	await writeFile(readmeArq, readmePerfil(perfil, { anterior, resumo, data, paginaUrl: pagina }));
	if (destino === 'README.md' && existsSync(path.join(dir, 'PERFIL.md'))) await rm(path.join(dir, 'PERFIL.md'));

	await writeFile(path.join(relDir, 'CHECKUP.md'), checkupMd({ perfil, data, auditoria, medicao, historico }));
	log(`Gerado: ${destino}, site/, relatorio/CHECKUP.md`);

	if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `publicar=${perfil.publicar_pages ? 'true' : 'false'}\n`);
	return { perfil, auditoria, medicao, historico, destino };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const a = args(process.argv.slice(2));
	executar(a).catch((e) => {
		console.error(e instanceof ErroPerfil ? `\n${e.message}\n` : e);
		process.exit(1);
	});
}
