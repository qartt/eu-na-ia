import { MOTORES, MODELOS_PADRAO } from './engines/index.mjs';
import { analisarResposta } from './match.mjs';
import { termosDe, termosConcorrentes } from './perfil.mjs';
import { preencher } from './util.mjs';

export function montarPerguntas(perfil) {
	const dados = {
		nome: perfil.nome,
		titulo: perfil.titulo,
		cidade: perfil.cidade,
		estado: perfil.estado,
		especialidade: perfil.especialidades[0] || '',
		segmento: perfil.titulo.charAt(0).toLowerCase() + perfil.titulo.slice(1),
		servico: perfil.especialidades[0] || '',
		concorrente: perfil.concorrentes[0]?.nome || '',
		projeto: perfil.projetos_destaque[0]?.nome || ''
	};
	// perguntas com variáveis que ficaram sem valor são descartadas
	return perfil.medicao.perguntas.map((q) => preencher(q, dados)).filter((q) => !/\{\w+\}/.test(q));
}

/** Motores configurados que têm chave disponível no ambiente. */
export function motoresAtivos(perfil, env = process.env) {
	return perfil.medicao.motores.filter((m) => MOTORES[m] && env[MOTORES[m].chave]);
}

export async function medir(perfil, { env = process.env, fetchImpl = globalThis.fetch, log = () => {} } = {}) {
	const ativos = motoresAtivos(perfil, env);
	const perguntas = montarPerguntas(perfil);
	if (!ativos.length || !perguntas.length) return { ativos, perguntas, resultados: [], taxa: null };

	const termos = termosDe(perfil);
	const rivais = termosConcorrentes(perfil);
	const resultados = [];
	for (const motor of ativos) {
		const mod = MOTORES[motor];
		const modelo = perfil.medicao.modelos[motor] || MODELOS_PADRAO[motor];
		for (const pergunta of perguntas) {
			log(`  ${mod.rotulo}: ${pergunta}`);
			try {
				const resp = await mod.perguntar(pergunta, { apiKey: env[mod.chave], modelo, fetchImpl });
				const concorrentes = rivais.filter((c) => analisarResposta(resp, c.termos).mencionado).map((c) => c.nome);
				resultados.push({ motor, rotulo: mod.rotulo, modelo, pergunta, ...analisarResposta(resp, termos), concorrentes });
			} catch (e) {
				resultados.push({ motor, rotulo: mod.rotulo, modelo, pergunta, erro: String(e.message || e).slice(0, 300) });
			}
		}
	}
	const validos = resultados.filter((r) => !r.erro);
	const taxa = validos.length ? Math.round((validos.filter((r) => r.mencionado).length / validos.length) * 100) : null;
	// participação: em quantas respostas válidas cada nome apareceu (você e concorrentes)
	const participacao = [{ nome: perfil.nome, voce: true, vezes: validos.filter((r) => r.mencionado).length }]
		.concat(perfil.concorrentes.map((c) => ({ nome: c.nome, voce: false, vezes: validos.filter((r) => r.concorrentes.includes(c.nome)).length })))
		.map((x) => ({ ...x, taxa: validos.length ? Math.round((x.vezes / validos.length) * 100) : null }))
		.sort((a, b) => b.vezes - a.vezes);
	return { ativos, perguntas, resultados, taxa, participacao };
}
