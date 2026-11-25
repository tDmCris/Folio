# Folio

**Folio** é um estúdio de escrita sem distrações com inteligência artificial colaborativa integrada diretamente à página. Em vez de copiar e colar textos entre um editor e uma janela de chat, você escreve livremente, anexa arquivos de referência, dá feedback direto na frase ou parágrafo e recebe sugestões editoriais proativas na margem.

## Funcionalidades

- **Geração de rascunhos com anexos multimodais**: crie um rascunho inicial a partir de um prompt, formato, tom, tamanho e arquivos de referência (`.md`, `.txt`, `.csv`, `.json`, `.pdf` e imagens). Os arquivos anexados permanecem vinculados ao documento como contexto para todas as revisões futuras.
- **Feedback inline com escopo inteligente (`⌘K` / `Ctrl+K`)**: selecione qualquer trecho ou acione o editor inline em um parágrafo e escolha o escopo:
  - **Auto**: o Folio decide automaticamente se o ajuste pede uma edição cirúrgica na frase, reescrita do parágrafo ou adaptação coordenada no artigo inteiro.
  - **Line**: altera apenas o trecho selecionado preservando o restante.
  - **Paragraph**: reescreve o parágrafo alvo.
  - **Article**: integra a mudança ao longo de todo o texto mantendo coerência.
- **Diff palavra por palavra e refinamento inline**: visualize exclusões e inserções diretamente no manuscrito, aceite ou descarte cada bloco individualmente (ou tudo de uma vez) e peça ajustes complementares na mesma revisão.
- **Thought Partner proativo (Marginalia)**: acompanha a escrita silenciosamente e exibe notas editoriais pontuais na margem apenas quando identifica uma melhoria relevante de clareza, argumento, evidência, fluidez ou voz — com pré-visualização de diff em um clique.
- **Experiência editorial completa**: modo Foco, alternância entre tema claro e escuro, múltiplos documentos salvos localmente, histórico automático de snapshots antes de cada alteração aceita e exportação para Markdown ou texto puro.

## Tecnologias

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, Lucide React
- **Backend**: Node.js, Express (`server.ts`), TSX
- **IA**: `@google/genai` (chamadas server-side via `/api/ai/*`)
  - `gemini-4-hydrogen` para geração de rascunhos e iterações inline com escopo inteligente
  - `gemini-3.1-flash-lite` para análise proativa rápida na margem

## Como executar localmente

### Pré-requisitos

- Node.js 20 ou superior
- Uma chave da API Gemini (`GEMINI_API_KEY`)

### Passo a passo

1. Clone o repositório e instale as dependências:

```bash
npm install
```

2. Configure as variáveis de ambiente copiando o arquivo de exemplo:

```bash
cp .env.example .env
```

3. Edite o arquivo `.env` e adicione sua chave:

```env
GEMINI_API_KEY="sua-chave-aqui"
```

4. Inicie o servidor de desenvolvimento (porta `3000`):

```bash
npm run dev
```

5. Acesse `http://localhost:3000` no navegador.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor Express com middleware do Vite na porta `3000` |
| `npm run build` | Compila o frontend para produção em `dist/` |
| `npm run start` | Executa o servidor de produção (`server.ts`) |
| `npm run lint` | Verifica tipos TypeScript com `tsc --noEmit` |

## Estrutura do projeto

```text
├── server.ts                      # Servidor Express + rotas /api/ai/* + middleware Vite
├── server/
│   └── gemini.ts                  # Integração server-side com o SDK @google/genai
├── src/
│   ├── App.tsx                    # Orquestração do estúdio de escrita e estado principal
│   ├── components/
│   │   ├── TopBar.tsx             # Navegação superior
│   │   ├── ManuscriptBlock.tsx    # Editor por blocos e visualização de diff inline
│   │   ├── InlineFeedbackBar.tsx  # Barra de feedback inline e seletor de escopo
│   │   ├── RevisionSessionBanner.tsx # Controle de revisões multi-parágrafo e follow-up
│   │   ├── MarginaliaRail.tsx     # Notas editoriais proativas na margem
│   │   ├── DraftComposerModal.tsx # Compositor de novos rascunhos com anexos
│   │   └── WorkspaceDrawers.tsx   # Gavetas de Documentos, Fontes, Histórico e Exportação
│   ├── services/aiClient.ts       # Cliente HTTP para os endpoints /api/ai/*
│   ├── types/writing.ts           # Tipos TypeScript do domínio
│   └── utils/                     # Diff palavra por palavra e leitura/exportação de arquivos
├── .env.example                   # Modelo de variáveis de ambiente
└── package.json
```
