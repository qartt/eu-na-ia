# Eu na IA

> Esta é a documentação do template. No seu repositório de perfil, o README.md é substituído pelo seu perfil; este arquivo continua aqui para consulta.

**Check-up de presença profissional para devs.** Mede o que as IAs respondem sobre você, aponta o que está inconsistente no GitHub e no seu site, e gera o README do perfil, uma página pessoal e os dados estruturados. Roda inteiro no GitHub Actions, sem servidor, em português.

[Gerar meu perfil.yml](https://qartt.github.io/eu-na-ia/gerador.html) · [Exemplo de relatório](../relatorio/CHECKUP.md) · [O que tem evidência](EVIDENCIAS.md)

## O que ele faz

**1. Audita a sua presença** e dá uma nota de 0 a 100, ponderada pela força da evidência de cada item:

- GitHub: nome, bio, localização, site, repositório de perfil, repositórios fixados, projetos com descrição, site, tópicos e licença;
- site: se abre, se tem dados estruturados `Person` ligados ao GitHub, se o `robots.txt` bloqueia robôs de IA, se tem `llms.txt`;
- consistência: o mesmo nome em todos os lugares.

**2. Pergunta para as IAs** (opcional, com a sua chave de API) coisas como "Indique desenvolvedores de WordPress em Belo Horizonte" e registra se você foi mencionado e se os seus links foram citados. Suporta Claude, ChatGPT, Gemini e Perplexity, com busca na web.

**3. Gera os arquivos** a partir de um único `perfil.yml`:

| Arquivo | Para quê |
|---|---|
| `README.md` | o README do seu perfil no GitHub, com selos |
| `site/index.html` | página pessoal com dados estruturados `ProfilePage` + `Person` |
| `site/snippet-jsonld.html` | bloco para colar na página "sobre" do seu próprio site |
| `site/llms.txt` | resumo em texto para modelos |
| `relatorio/CHECKUP.md` | relatório com o que corrigir primeiro e o histórico mês a mês |

## O que ele não faz

Não faz a IA "te encontrar" por mágica. Ele mede, aponta e deixa o seu trabalho legível e conectado. O que faz alguém aparecer de verdade é trabalho público: projetos, artigos, contribuições e outras pessoas citando você. Cada verificação diz se é **comprovada**, **provável** ou **aposta**; leia [docs/EVIDENCIAS.md](EVIDENCIAS.md).

## Como usar

1. Clique em **Use this template → Create a new repository** e dê ao repositório **o mesmo nome do seu usuário** (ex.: `mariasouza/mariasouza`). É esse repositório especial que o GitHub mostra no topo do seu perfil.
2. Edite o `perfil.yml` com os seus dados. Se preferir, preencha o [formulário](https://qartt.github.io/eu-na-ia/gerador.html) e cole o resultado.
3. Salve (*Commit changes*). Em cerca de um minuto, a Action gera o README, a página e o relatório.
4. **Página pessoal (opcional):** em *Settings → Pages*, escolha **Source: GitHub Actions**. A página fica em `usuario.github.io/usuario`.
5. **Medição nas IAs (opcional):** em *Settings → Secrets and variables → Actions → New repository secret*, cadastre uma ou mais chaves:

| Secret | Provedor |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | ChatGPT |
| `GEMINI_API_KEY` | Gemini |
| `PERPLEXITY_API_KEY` | Perplexity |

O check-up roda sozinho todo dia 1 e sempre que você altera o `perfil.yml`. Para rodar na hora, use *Actions → Check-up de presença → Run workflow*.

**Custo:** a auditoria e a geração não custam nada. A medição usa a sua chave: com 3 perguntas por motor uma vez por mês, o custo costuma ser de centavos de dólar, mas a busca na web é cobrada à parte por alguns provedores. Confira a tabela de preços de cada um.

## Personalizar

- Escreva o que quiser no README entre `<!-- livre:inicio -->` e `<!-- livre:fim -->`. Esse trecho é preservado em todas as atualizações.
- Troque as perguntas em `medicao.perguntas`. Variáveis disponíveis: `{nome}`, `{titulo}`, `{cidade}`, `{estado}`, `{especialidade}` e `{projeto}`.
- Os modelos de IA mudam com frequência. Se algum for descontinuado, ajuste `medicao.modelos`.

## Privacidade

- Tudo o que está no `perfil.yml` fica público. Não coloque telefone, endereço ou e-mail pessoal se não quiser que apareçam.
- As chaves de API ficam nos Secrets do seu repositório e só são lidas pela Action.
- A medição envia as perguntas aos provedores escolhidos; o relatório guarda apenas um trecho curto das respostas.

## Rodar localmente

```bash
npm install
GITHUB_REPOSITORY=seu-usuario/seu-usuario npm run checkup:local   # sem medição
npm test
```

## Projetos relacionados

Existem várias ferramentas open source de "visibilidade em IA" (GEO/AEO) voltadas para **marcas**, como o [Limelit Open](https://github.com/limelitgeo/open) e o [Aperture](https://github.com/anyin-ai/aperture). O Eu na IA é focado em **pessoa desenvolvedora**, roda como template de perfil do GitHub sem servidor e é em português.

## Licença

[MIT](../LICENSE). Criado por [João Cabral](https://qartt.com.br), Qartt Tecnologia, Belo Horizonte.
