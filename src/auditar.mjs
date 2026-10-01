import { buscar, normalizar, hostDe } from './util.mjs';

/**
 * Níveis de evidência (explicados em docs/EVIDENCIAS.md):
 *  comprovado — mecanismo documentado publicamente pelos próprios buscadores/IAs
 *  provavel   — boa prática com efeito indireto plausível, sem medição pública direta
 *  aposta     — convenção emergente, sem evidência de uso pelas IAs hoje
 */
export const PESOS = { comprovado: 3, provavel: 2, aposta: 1 };

export const ROBOS_IA = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended'];

function item(id, titulo, evidencia, status, detalhe, comoCorrigir = '') {
	return { id, titulo, evidencia, status, detalhe, comoCorrigir };
}
// status: ok | atencao | falha | pulado

/** Extrai todos os objetos JSON-LD de um HTML (achata @graph). */
export function extrairJsonLd(html) {
	const objs = [];
	const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let m;
	while ((m = re.exec(html))) {
		try {
			const d = JSON.parse(m[1].trim());
			const fila = Array.isArray(d) ? [...d] : [d];
			while (fila.length) {
				const o = fila.shift();
				if (!o || typeof o !== 'object') continue;
				objs.push(o);
				if (Array.isArray(o['@graph'])) fila.push(...o['@graph']);
				if (o.mainEntity && typeof o.mainEntity === 'object') fila.push(o.mainEntity);
			}
		} catch {
			/* JSON-LD inválido é ignorado e reportado pela ausência */
		}
	}
	return objs;
}

const tipos = (o) => [].concat(o['@type'] || []).map(String);

/** Robôs de IA bloqueados por completo no robots.txt (Disallow: / no grupo aplicável). */
export function robosBloqueados(robots, robos = ROBOS_IA) {
	const grupos = [];
	let atual = null;
	let ultimaFoiAgente = false;
	for (const linhaBruta of String(robots).split(/\r?\n/)) {
		const linha = linhaBruta.replace(/#.*/, '').trim();
		if (!linha) continue;
		const i = linha.indexOf(':');
		if (i < 0) continue;
		const campo = linha.slice(0, i).trim().toLowerCase();
		const valor = linha.slice(i + 1).trim();
		if (campo === 'user-agent') {
			if (!ultimaFoiAgente || !atual) { atual = { agentes: [], regras: [] }; grupos.push(atual); }
			atual.agentes.push(valor.toLowerCase());
			ultimaFoiAgente = true;
		} else {
			ultimaFoiAgente = false;
			if (atual && (campo === 'disallow' || campo === 'allow')) atual.regras.push([campo, valor]);
		}
	}
	const bloqueiaTudo = (g) => g.regras.some(([c, v]) => c === 'disallow' && v === '/') && !g.regras.some(([c, v]) => c === 'allow' && v === '/');
	return robos.filter((robo) => {
		const r = robo.toLowerCase();
		const especifico = grupos.find((g) => g.agentes.some((a) => a !== '*' && r.includes(a)));
		const grupo = especifico || grupos.find((g) => g.agentes.includes('*'));
		return grupo ? bloqueiaTudo(grupo) : false;
	});
}

async function gh(caminho, token, fetchImpl) {
	const r = await buscar(`https://api.github.com${caminho}`, {
		headers: { accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) }
	}, fetchImpl);
	if (r.status === 404) return null;
	if (!r.ok) throw new Error(`GitHub API ${caminho}: HTTP ${r.status}`);
	return r.json();
}

async function fixados(usuario, token, fetchImpl) {
	if (!token) return null;
	const r = await buscar('https://api.github.com/graphql', {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({ query: 'query($l:String!){user(login:$l){pinnedItems(first:6,types:REPOSITORY){totalCount}}}', variables: { l: usuario } })
	}, fetchImpl);
	if (!r.ok) return null;
	const d = await r.json();
	return d?.data?.user?.pinnedItems?.totalCount ?? null;
}

/** Roda todas as verificações. Erros de rede viram itens "pulado", nunca derrubam o check-up. */
export async function auditar(perfil, { token = '', fetchImpl = globalThis.fetch } = {}) {
	const itens = [];
	const u = perfil.usuario_github;
	const nomeNorm = normalizar(perfil.nome);

	// ── GitHub ─────────────────────────────────────────────
	let usuario = null;
	try {
		usuario = await gh(`/users/${u}`, token, fetchImpl);
	} catch (e) {
		itens.push(item('gh_api', 'Leitura do perfil no GitHub', 'comprovado', 'pulado', e.message));
	}
	if (usuario === null && !itens.length) {
		itens.push(item('gh_existe', 'Usuário do GitHub existe', 'comprovado', 'falha', `@${u} não encontrado`, 'Confira "usuario_github" no perfil.yml.'));
	}
	if (usuario) {
		const nomeGh = normalizar(usuario.name);
		itens.push(item('gh_nome', 'Nome no GitHub igual ao do perfil', 'provavel',
			!usuario.name ? 'falha' : nomeGh === nomeNorm || nomeGh.includes(nomeNorm) ? 'ok' : 'atencao',
			usuario.name ? `GitHub: "${usuario.name}" · perfil.yml: "${perfil.nome}"` : 'Nome em branco no GitHub',
			'Em github.com/settings/profile, use o mesmo nome do perfil.yml. Nomes diferentes em cada lugar dificultam saber que é a mesma pessoa.'));
		itens.push(item('gh_bio', 'Bio preenchida no GitHub', 'provavel', usuario.bio ? 'ok' : 'falha',
			usuario.bio ? `"${usuario.bio}"` : 'Bio em branco',
			`Escreva uma linha com o que você faz, por exemplo: "${perfil.titulo}".`));
		itens.push(item('gh_local', 'Localização preenchida no GitHub', 'provavel', usuario.location ? 'ok' : 'falha',
			usuario.location || 'Localização em branco',
			`Preencha com "${perfil.local || 'sua cidade'}". Perguntas do tipo "devs em <cidade>" dependem disso.`));
		const blog = String(usuario.blog || '');
		const liga = perfil.site && blog && hostDe(blog.startsWith('http') ? blog : `https://${blog}`) === hostDe(perfil.site);
		itens.push(item('gh_site', 'GitHub aponta para o seu site', 'provavel',
			!perfil.site ? 'pulado' : liga ? 'ok' : blog ? 'atencao' : 'falha',
			!perfil.site ? 'Sem site no perfil.yml' : blog ? `Campo "website": ${blog}` : 'Campo "website" em branco',
			'Em github.com/settings/profile, coloque o mesmo site do perfil.yml no campo Website.'));
	}

	if (usuario) {
		try {
			const repoPerfil = await gh(`/repos/${u}/${u}`, token, fetchImpl);
			itens.push(item('gh_readme', 'Repositório de perfil (usuario/usuario)', 'provavel', repoPerfil ? 'ok' : 'falha',
				repoPerfil ? `github.com/${u}/${u} existe` : 'Repositório de perfil não existe',
				`Crie o repositório ${u}/${u} a partir deste template. O README dele aparece no topo do seu perfil.`));
		} catch (e) {
			itens.push(item('gh_readme', 'Repositório de perfil (usuario/usuario)', 'provavel', 'pulado', e.message));
		}
		try {
			const n = await fixados(u, token, fetchImpl);
			itens.push(item('gh_fixados', 'Repositórios fixados no perfil', 'provavel',
				n == null ? 'pulado' : n >= 3 ? 'ok' : n > 0 ? 'atencao' : 'falha',
				n == null ? 'Não verificado (requer GITHUB_TOKEN)' : `${n} fixado(s)`,
				'No seu perfil, clique em "Customize your pins" e fixe de 3 a 6 projetos que representem o seu trabalho.'));
		} catch (e) {
			itens.push(item('gh_fixados', 'Repositórios fixados no perfil', 'provavel', 'pulado', e.message));
		}
	}

	for (const p of perfil.projetos_destaque.filter((x) => x.repo)) {
		try {
			const r = await gh(`/repos/${p.repo}`, token, fetchImpl);
			if (!r) {
				itens.push(item(`repo:${p.repo}`, `Projeto ${p.nome}`, 'provavel', 'falha', `${p.repo} não encontrado`, 'Confira o campo "repo" no perfil.yml.'));
				continue;
			}
			const faltas = [];
			if (!r.description) faltas.push('descrição');
			if (!r.homepage) faltas.push('site (homepage)');
			if (!r.topics || r.topics.length < 3) faltas.push(`tópicos (${(r.topics || []).length}/3)`);
			if (!r.license) faltas.push('licença');
			itens.push(item(`repo:${p.repo}`, `Projeto ${p.nome}: descrição, site, tópicos e licença`, 'provavel',
				faltas.length === 0 ? 'ok' : faltas.length <= 1 ? 'atencao' : 'falha',
				faltas.length ? `Falta: ${faltas.join(', ')}` : 'Completo',
				'Na página do repositório, clique na engrenagem ao lado de "About" e preencha descrição, site e pelo menos 3 tópicos.'));
		} catch (e) {
			itens.push(item(`repo:${p.repo}`, `Projeto ${p.nome}`, 'provavel', 'pulado', e.message));
		}
	}

	// ── Site ───────────────────────────────────────────────
	if (!perfil.site) {
		itens.push(item('site', 'Site próprio', 'provavel', 'falha', 'Sem "site" no perfil.yml',
			'Um site seu, mesmo que simples, é o lugar onde você controla como é descrito. A página gerada aqui pode ser esse site.'));
	} else {
		let html = null;
		let siteRecusou = false;
		try {
			const r = await buscar(perfil.site, {}, fetchImpl);
			if (r.ok) html = await r.text();
			siteRecusou = r.status === 401 || r.status === 403 || r.status === 429;
			itens.push(item('site_ok', 'Site responde', 'comprovado',
				r.ok ? 'ok' : siteRecusou ? 'atencao' : 'falha',
				siteRecusou ? `O site recusou o robô do check-up (HTTP ${r.status})` : `HTTP ${r.status}`,
				siteRecusou
					? 'Provável proteção anti-robô (Cloudflare, plugin de segurança). Confira se ela não barra também GPTBot, ClaudeBot e PerplexityBot; se barrar, as IAs não leem o seu site.'
					: 'Se o site não abre, nada mais sobre ele é lido.'));
		} catch (e) {
			itens.push(item('site_ok', 'Site responde', 'comprovado', 'falha', `Erro: ${e.message}`, 'Se o site não abre, nada mais sobre ele é lido.'));
		}
		if (html != null) {
			const objs = extrairJsonLd(html);
			const pessoa = objs.find((o) => tipos(o).includes('Person'));
			itens.push(item('site_person', 'Site tem dados estruturados de Person', 'provavel', pessoa ? 'ok' : 'falha',
				pessoa ? `Person: "${pessoa.name || 'sem nome'}"` : `Nenhum Person em ${objs.length} bloco(s) JSON-LD`,
				'Cole o conteúdo de site/snippet-jsonld.html no <head> da página "sobre" do seu site.'));
			if (pessoa) {
				const sa = [].concat(pessoa.sameAs || []).map((s) => String(s).toLowerCase().replace(/\/$/, ''));
				itens.push(item('site_sameas', 'Dados estruturados ligam o site ao GitHub (sameAs)', 'provavel',
					sa.includes(perfil.github_url.toLowerCase()) ? 'ok' : 'falha',
					sa.length ? `sameAs: ${sa.join(', ')}` : 'sameAs vazio',
					`Inclua ${perfil.github_url} em "sameAs". É o que conecta o site e o GitHub como a mesma pessoa.`));
				itens.push(item('site_nome', 'Nome nos dados estruturados igual ao do perfil', 'provavel',
					normalizar(pessoa.name) === nomeNorm ? 'ok' : 'atencao', `"${pessoa.name || ''}"`, 'Use exatamente o mesmo nome em todos os lugares.'));
			}
		}
		const origem = (() => { try { return new URL(perfil.site).origin; } catch { return ''; } })();
		if (origem) {
			try {
				const r = await buscar(`${origem}/robots.txt`, {}, fetchImpl);
				const indisponivel = r.status === 429 || r.status >= 500 || (siteRecusou && (r.status === 401 || r.status === 403));
				const bloqueados = r.ok ? robosBloqueados(await r.text()) : [];
				itens.push(item('robots_ia', 'robots.txt não bloqueia robôs de IA', 'comprovado',
					indisponivel ? 'pulado' : bloqueados.length ? 'falha' : 'ok',
					indisponivel ? `Não foi possível ler (HTTP ${r.status})`
						: r.status === 404 || r.status === 410 ? 'Sem robots.txt: nada bloqueado'
						: !r.ok ? `robots.txt inacessível (HTTP ${r.status}): tratado como sem restrições`
						: bloqueados.length ? `Bloqueados: ${bloqueados.join(', ')}` : 'Nenhum robô de IA bloqueado',
					'OpenAI, Anthropic, Perplexity e Google documentam que seus robôs respeitam o robots.txt. Se bloqueados, eles não leem o seu site.'));
			} catch (e) {
				itens.push(item('robots_ia', 'robots.txt não bloqueia robôs de IA', 'comprovado', 'pulado', e.message));
			}
			try {
				const r = await buscar(`${origem}/llms.txt`, {}, fetchImpl);
				const t = r.ok ? await r.text() : '';
				const valido = r.ok && /^\s*#\s+\S/.test(t);
				const naoLido = !r.ok && (siteRecusou || r.status >= 500);
				itens.push(item('llms_txt', 'Site tem /llms.txt', 'aposta', naoLido ? 'pulado' : valido ? 'ok' : 'atencao',
					valido ? 'Encontrado' : r.ok ? 'Existe, mas não começa com um título "# ..."' : `HTTP ${r.status}`,
					'Opcional. Copie site/llms.txt para a raiz do seu site. Não há evidência de que as IAs usem esse arquivo hoje; é uma aposta barata.'));
			} catch (e) {
				itens.push(item('llms_txt', 'Site tem /llms.txt', 'aposta', 'pulado', e.message));
			}
		}
	}

	// ── Identidade em outros lugares ──────────────────────
	itens.push(item('linkedin', 'LinkedIn informado', 'provavel', perfil.links.linkedin ? 'ok' : 'atencao',
		perfil.links.linkedin || 'Sem LinkedIn no perfil.yml',
		'Adicione o link do LinkedIn em "links.linkedin". Ele entra no sameAs e reforça a identidade.'));

	return { itens, nota: notaPresenca(itens) };
}

/** Nota 0–100 ponderada pela evidência. Itens pulados não contam. */
export function notaPresenca(itens) {
	let total = 0, obtido = 0;
	for (const i of itens) {
		if (i.status === 'pulado') continue;
		const p = PESOS[i.evidencia] || 1;
		total += p;
		obtido += i.status === 'ok' ? p : i.status === 'atencao' ? p / 2 : 0;
	}
	return total ? Math.round((obtido / total) * 100) : null;
}
