# O que tem evidência e o que é aposta

O Eu na IA classifica cada verificação em três níveis. A nota de presença dá mais peso ao que tem evidência mais forte (comprovado = 3, provável = 2, aposta = 1).

Ninguém de fora das empresas sabe exatamente como cada IA escolhe quem citar. Este documento separa o que é documentado do que é boa prática e do que é palpite, para você decidir onde investir tempo.

## Comprovado

Mecanismos documentados publicamente pelos próprios buscadores e empresas de IA.

**O site precisa abrir.** Se o site devolve erro ou bloqueia robôs, nenhuma IA consegue ler o conteúdo dele na busca em tempo real.

**robots.txt não pode bloquear os robôs de IA.** OpenAI (GPTBot, OAI-SearchBot, ChatGPT-User), Anthropic (ClaudeBot e afins) e Perplexity (PerplexityBot) documentam que seus robôs respeitam o robots.txt. Se o seu site tem `User-agent: GPTBot` com `Disallow: /`, o ChatGPT não lê o seu site. O check-up também lista o `Google-Extended`, que controla o uso do conteúdo pelos modelos Gemini; ele não afeta a Busca Google nem os AI Overviews.

Atenção a proteções anti-robô (Cloudflare, plugins de segurança): algumas bloqueiam robôs de IA por padrão, mesmo com o robots.txt liberado. Quando o site recusa o robô do check-up, o relatório avisa.

## Provável

Boas práticas com efeito indireto plausível, sem medição pública direta do impacto nas respostas das IAs.

**Identidade consistente.** Mesmo nome, mesmo título e mesma cidade no GitHub, no site e no LinkedIn. IAs e buscadores precisam decidir se "João Cabral" do GitHub e "João Cabral" do site são a mesma pessoa; sinais iguais facilitam.

**Ligações cruzadas.** GitHub apontando para o site (campo Website) e site apontando para o GitHub (`sameAs` nos dados estruturados).

**Dados estruturados Person / ProfilePage.** O Google documenta o tipo [ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page) para páginas de perfil. Ajuda buscadores a entender quem você é; como as IAs com busca usam buscadores, o efeito é indireto.

**Perfil e repositórios completos no GitHub.** Bio, localização, repositórios fixados, descrição, site e tópicos nos projetos. É o que aparece nos resultados de busca e o que um modelo lê ao abrir o seu perfil.

### No modo empresa

**Dados estruturados Organization / LocalBusiness.** O Google documenta os tipos [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization) e [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business). Mesmo raciocínio do Person: ajudam buscadores, e as IAs com busca dependem deles.

**Nome, endereço e telefone iguais em todo lugar.** Prática consolidada de SEO local. Divergências dificultam saber que o site, o Google e as redes são a mesma empresa.

**Perfil da Empresa no Google.** Para negócio local, é a principal fonte do Google para buscas e mapas, e aparece com frequência como fonte nas respostas com busca.

**Título, meta description e sitemap.** O título e a descrição são o que os buscadores mostram e o que um modelo lê primeiro; o sitemap ajuda os robôs a encontrar as páginas. Efeito nas IAs: indireto.

## Aposta

Convenções emergentes sem evidência de uso pelas IAs hoje. Baratas de adotar, mas não espere resultado.

**llms.txt.** Proposto em 2024 em [llmstxt.org](https://llmstxt.org) como um resumo do site em Markdown para modelos. Um teste da [Evil Martians](https://evilmartians.com/chronicles/how-to-make-your-website-visible-to-llms) observou que quase todos os acessos ao arquivo vinham do GoogleBot, sem acessos dos robôs do ChatGPT, Claude ou Perplexity. O Eu na IA gera o arquivo porque custa nada, mas ele vale só 1 ponto na nota.

## Sobre a medição nas IAs

- As respostas mudam a cada pergunta, mesmo idênticas. Olhe a tendência ao longo dos meses, não um resultado isolado.
- A medição usa as APIs com busca na web, que podem dar resultados diferentes dos aplicativos (ChatGPT, Claude.ai, Gemini) que o público usa.
- As menções são encontradas por busca de texto (nome, apelidos, usuário do GitHub, domínios). Nenhum modelo decide se "viu" você. Homônimos podem gerar falsos positivos; confira os trechos no relatório.
- Perguntas diretas ("Quem é Fulano?") quase sempre encontram você se houver qualquer página com o seu nome. As perguntas de descoberta ("devs de X em Y") são o teste que importa.

## O que nenhuma ferramenta faz

Nada aqui substitui trabalho real e público: projetos, artigos, palestras, contribuições e outras pessoas citando você. O check-up garante que esse trabalho seja legível e conectado; não o cria.
