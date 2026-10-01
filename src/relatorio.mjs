import { escMd, PROJETO_URL } from './util.mjs';

const ICONE = { ok: '✅', atencao: '⚠️', falha: '❌', pulado: '⏭️' };
const EVID = { comprovado: 'Comprovado', provavel: 'Provável', aposta: 'Aposta' };

export function checkupMd({ perfil, data, auditoria, medicao, historico }) {
	const l = [];
	l.push(`# Check-up de presença — ${perfil.nome}`, '');
	l.push(`Gerado em ${data} pelo [Eu na IA](${PROJETO_URL}).`, '');
	l.push('## Resumo', '');
	l.push(`| Indicador | Resultado |`, `|---|---|`);
	l.push(`| Presença profissional | ${auditoria ? (auditoria.nota != null ? `**${auditoria.nota}/100**` : 'sem dados') : 'não auditado'} |`);
	l.push(`| Citado pelas IAs | ${medicao?.taxa != null ? `**${medicao.taxa}%** das respostas` : 'sem medição (nenhuma chave de API configurada)'} |`, '');

	if (auditoria) {
		const pendentes = auditoria.itens.filter((i) => i.status === 'falha' || i.status === 'atencao');
		if (pendentes.length) {
			l.push('## O que fazer primeiro', '');
			const ordem = { comprovado: 0, provavel: 1, aposta: 2 };
			pendentes
				.sort((a, b) => ordem[a.evidencia] - ordem[b.evidencia] || (a.status === 'falha' ? -1 : 1))
				.slice(0, 5)
				.forEach((i, n) => l.push(`${n + 1}. **${i.titulo}** (${EVID[i.evidencia].toLowerCase()}): ${i.comoCorrigir}`));
			l.push('');
		}
		l.push('## Verificações', '');
		l.push('| | Verificação | Evidência | Detalhe |', '|---|---|---|---|');
		auditoria.itens.forEach((i) => l.push(`| ${ICONE[i.status]} | ${escMd(i.titulo)} | ${EVID[i.evidencia]} | ${escMd(i.detalhe)} |`));
		l.push('', '> **Comprovado**: mecanismo documentado pelos próprios buscadores e IAs. **Provável**: boa prática com efeito indireto, sem medição pública direta. **Aposta**: convenção sem evidência de uso hoje. Detalhes em [docs/EVIDENCIAS.md](../docs/EVIDENCIAS.md).', '');
	}

	if (medicao && medicao.resultados.length) {
		l.push('## O que as IAs responderam', '');
		l.push('As respostas mudam a cada pergunta. Leia como tendência ao longo dos meses, não como nota exata.', '');
		l.push('| Motor | Pergunta | Mencionou você? | Citou seus links? |', '|---|---|---|---|');
		medicao.resultados.forEach((r) => {
			const m = r.erro ? `erro: ${escMd(r.erro)}` : r.mencionado ? `✅ ${escMd(r.termos.join(', '))}` : '—';
			const c = r.erro ? '' : r.citado ? `✅ ${r.citacoes.length}` : '—';
			l.push(`| ${escMd(r.rotulo)} | ${escMd(r.pergunta)} | ${m} | ${c} |`);
		});
		const trechos = medicao.resultados.filter((r) => r.trecho);
		if (trechos.length) {
			l.push('', '<details><summary>Trechos onde você aparece</summary>', '');
			trechos.forEach((r) => l.push(`**${escMd(r.rotulo)}** — ${escMd(r.pergunta)}`, '', `> …${escMd(r.trecho)}…`, ''));
			l.push('</details>', '');
		}
		l.push('');
	}

	if (historico.length > 1) {
		l.push('## Histórico', '', '| Data | Presença | Citado pelas IAs |', '|---|---|---|');
		historico.slice(-12).reverse().forEach((h) => l.push(`| ${h.data} | ${h.presenca ?? '—'} | ${h.ia != null ? `${h.ia}%` : '—'} |`));
		l.push('');
	}

	l.push('## Arquivos gerados', '');
	l.push('- `site/index.html`: página pessoal com dados estruturados (ProfilePage + Person)');
	l.push('- `site/snippet-jsonld.html`: bloco para colar no `<head>` da página "sobre" do seu site');
	l.push('- `site/perfil.jsonld`: os mesmos dados em JSON');
	l.push('- `site/llms.txt`: resumo em texto para modelos (aposta, ver evidências)');
	l.push('');
	return l.join('\n');
}
