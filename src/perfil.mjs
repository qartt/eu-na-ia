import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

const MOTORES = ['anthropic', 'openai', 'gemini', 'perplexity'];

export class ErroPerfil extends Error {}

export function slug(s) {
	return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function lista(v) {
	if (v == null || v === '') return [];
	return (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
}

function url(v, campo, erros) {
	if (!v) return '';
	try {
		const u = new URL(String(v).trim());
		if (!/^https?:$/.test(u.protocol)) throw new Error();
		return u.toString();
	} catch {
		erros.push(`"${campo}" não é uma URL válida (use https://...)`);
		return '';
	}
}

/** Valida e normaliza o perfil. Lança ErroPerfil com todos os problemas encontrados. */
export function validarPerfil(bruto) {
	const p = bruto && typeof bruto === 'object' ? bruto : {};
	const erros = [];
	const txt = (k) => (p[k] == null ? '' : String(p[k]).trim());

	const tipo = (txt('tipo') || 'pessoa').toLowerCase();
	if (!['pessoa', 'empresa'].includes(tipo)) erros.push('"tipo" deve ser pessoa ou empresa');
	const empresa = tipo === 'empresa';

	const perfil = {
		tipo: empresa ? 'empresa' : 'pessoa',
		nome: txt('nome'),
		apelidos: lista(p.apelidos),
		usuario_github: txt('usuario_github').replace(/^@/, ''),
		titulo: empresa ? txt('segmento') || txt('titulo') : txt('titulo'),
		cidade: txt('cidade'),
		estado: txt('estado'),
		pais: txt('pais'),
		sobre: (txt('sobre') || txt('descricao')).replace(/\s+/g, ' '),
		especialidades: empresa ? lista(p.servicos).concat(lista(p.especialidades)) : lista(p.especialidades),
		idiomas: lista(p.idiomas),
		site: url(p.site, 'site', erros),
		empresa: { nome: '', site: '' },
		links: { linkedin: '', instagram: '', google_negocio: '', outros: [] },
		nome_legal: txt('nome_legal'),
		negocio_local: p.negocio_local === true,
		telefone: txt('telefone'),
		email_publico: txt('email_publico'),
		endereco: txt('endereco'),
		cep: txt('cep'),
		logo: url(p.logo, 'logo', erros),
		concorrentes: [],
		projetos_destaque: [],
		medicao: { motores: [], modelos: {}, perguntas: [] },
		publicar_pages: p.publicar_pages == null ? !empresa : p.publicar_pages !== false
	};

	if (!perfil.nome) erros.push('"nome" é obrigatório');
	if (!empresa && !perfil.usuario_github) erros.push('"usuario_github" é obrigatório');
	if (perfil.usuario_github && !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(perfil.usuario_github)) erros.push('"usuario_github" inválido');
	if (!perfil.titulo) erros.push(empresa ? '"segmento" é obrigatório (ex.: Escritório de advocacia empresarial)' : '"titulo" é obrigatório (ex.: Desenvolvedora backend Python)');
	if (empresa && !txt('site')) erros.push('"site" é obrigatório para empresas');

	if (p.empresa && typeof p.empresa === 'object') {
		perfil.empresa.nome = String(p.empresa.nome || '').trim();
		perfil.empresa.site = url(p.empresa.site, 'empresa.site', erros);
	}

	const links = p.links && typeof p.links === 'object' ? p.links : {};
	perfil.links.linkedin = url(links.linkedin, 'links.linkedin', erros);
	perfil.links.instagram = url(links.instagram, 'links.instagram', erros);
	perfil.links.google_negocio = url(links.google_negocio, 'links.google_negocio', erros);

	(Array.isArray(p.concorrentes) ? p.concorrentes : []).slice(0, 8).forEach((c, i) => {
		const nome = String((c && typeof c === 'object' ? c.nome : c) || '').trim();
		if (!nome) return;
		const site = c && typeof c === 'object' ? url(c.site, `concorrentes[${i}].site`, erros) : '';
		perfil.concorrentes.push({ nome, site });
	});
	perfil.links.outros = lista(links.outros).map((u, i) => url(u, `links.outros[${i}]`, erros)).filter(Boolean);

	(Array.isArray(p.projetos_destaque) ? p.projetos_destaque : []).forEach((pr, i) => {
		if (!pr || typeof pr !== 'object') return;
		const nome = String(pr.nome || '').trim();
		const repo = String(pr.repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
		if (!nome) { erros.push(`projetos_destaque[${i}]: "nome" é obrigatório`); return; }
		if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) erros.push(`projetos_destaque[${i}]: "repo" deve ser usuario/repositorio`);
		perfil.projetos_destaque.push({
			nome,
			repo,
			url: url(pr.url, `projetos_destaque[${i}].url`, erros) || (repo ? `https://github.com/${repo}` : ''),
			descricao: String(pr.descricao || '').trim()
		});
	});

	const m = p.medicao && typeof p.medicao === 'object' ? p.medicao : {};
	perfil.medicao.motores = lista(m.motores).map((x) => x.toLowerCase()).filter((x) => {
		if (MOTORES.includes(x)) return true;
		erros.push(`medicao.motores: "${x}" não é suportado (use ${MOTORES.join(', ')})`);
		return false;
	});
	perfil.medicao.modelos = m.modelos && typeof m.modelos === 'object' ? { ...m.modelos } : {};
	perfil.medicao.perguntas = lista(m.perguntas).slice(0, 10);

	if (erros.length) throw new ErroPerfil('perfil.yml com problemas:\n- ' + erros.join('\n- '));

	perfil.github_url = perfil.usuario_github ? `https://github.com/${perfil.usuario_github}` : '';
	perfil.local = [perfil.cidade, perfil.estado, perfil.pais].filter(Boolean).join(', ');
	perfil.id = empresa ? `empresa-${slug(perfil.nome)}` : perfil.usuario_github;
	return perfil;
}

export async function carregarPerfil(caminho = 'perfil.yml') {
	let texto;
	try {
		texto = await readFile(caminho, 'utf8');
	} catch {
		throw new ErroPerfil(`Não encontrei ${caminho}. Copie o exemplo e preencha com os seus dados.`);
	}
	let bruto;
	try {
		bruto = YAML.parse(texto);
	} catch (e) {
		throw new ErroPerfil(`perfil.yml não é um YAML válido: ${e.message}`);
	}
	return validarPerfil(bruto);
}

/** Termos usados para reconhecer menções nas respostas das IAs. */
export function termosDe(perfil) {
	const nomes = [perfil.nome, ...perfil.apelidos].filter(Boolean);
	const dominios = [perfil.site, perfil.empresa.site, ...perfil.links.outros]
		.map((u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } })
		.filter(Boolean);
	return { nomes, usuario: perfil.usuario_github, dominios: [...new Set(dominios)] };
}

/** Termos de cada concorrente (nome e domínio), para comparar quem as IAs citam. */
export function termosConcorrentes(perfil) {
	return perfil.concorrentes.map((c) => ({
		nome: c.nome,
		termos: { nomes: [c.nome], usuario: '', dominios: c.site ? [new URL(c.site).hostname.replace(/^www\./, '')] : [] }
	}));
}
