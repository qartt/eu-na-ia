# Como contribuir

O Eu na IA é pequeno de propósito: um CLI em Node, uma dependência (`yaml`) e testes com `node:test`.

## Ambiente

```bash
npm install
npm test
GITHUB_REPOSITORY=seu-usuario/seu-usuario npm run checkup:local
```

## Estrutura

```
src/perfil.mjs      leitura e validação do perfil.yml
src/auditar.mjs     verificações (cada uma com nível de evidência)
src/medir.mjs       perguntas às IAs
src/engines/        um arquivo por provedor (anthropic, openai, gemini, perplexity)
src/match.mjs       detecção de menções por texto
src/gerar.mjs       README, página, JSON-LD e llms.txt
src/relatorio.mjs   relatorio/CHECKUP.md
src/cli.mjs         orquestra tudo
templates/          formulário gerador do perfil.yml
```

## Regras da casa

- **Toda verificação nova declara o nível de evidência** (`comprovado`, `provavel` ou `aposta`) e entra em `docs/EVIDENCIAS.md` com a fonte. Sem fonte, é `aposta`.
- Nada de prometer resultado. O texto explica o que é medido e o limite da medição.
- Falha de rede ou de API vira item `pulado`, nunca derruba o check-up.
- Provedor novo: crie `src/engines/<nome>.mjs` exportando `chave`, `rotulo`, `perguntar()` e `extrair()`, registre em `src/engines/index.mjs` e teste o `extrair()` com uma resposta real anonimizada.

## Pull requests

Um assunto por PR, com `npm test` passando.
