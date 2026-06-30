# Escala de Serviço - Comunidade Mundo Novo

Sistema web estático para montar a escala mensal em formato parecido com a planilha atual, permitir confirmação dos músicos e registrar pendências de remanejamento.

## Eventos fixos do mês

O botão `Gerar eventos fixos` cria automaticamente a agenda recorrente:

- `Noite de Louvor`: toda segunda-feira, às `19:30`.
- `Missa Quinta-Feira`: toda quinta-feira, às `19:30`.
- `Missa Dominical`: todos os domingos, às `08:00`.
- `Missa Dominical`: todos os domingos, às `09:30`.

Os horários de segunda e quinta podem ser ajustados no cadastro de eventos depois da geração.

## Identidade visual

O layout usa a logo do perfil público `@comunidademundonovobh` como asset local em `assets/logo-mundo-novo.jpg`.
A paleta aplicada no CSS foi extraída da própria marca:

- Azul principal: `#062966`
- Azul médio: `#204e8b`
- Azul de apoio: `#0c3b82`
- Branco gelo: `#ebeef2`
- Dourado de destaque: `#c59b42`

As telas foram ajustadas para uso em celular e tablet; no coordenador, a grade larga vira cards editáveis por data em telas menores e a montagem da escala é separada por semana.

## Arquivos principais

- `index.html`: tela inicial com acesso ao coordenador e ao músico.
- `coordenador.html`: área administrativa com grade mensal, cadastros, pendências e histórico.
- `musico.html`: consulta individual para confirmar ou recusar presença e adicionar escala confirmada à agenda.
- `instalar.html`: instruções para instalar o app no Android, iPhone ou iPad.
- `manifest.webmanifest` e `service-worker.js`: arquivos do PWA instalável.
- `style.css`: estilos responsivos.
- `config.js`: URL da API, chave administrativa e senha simples da área do coordenador.
- `app.js`: dados, regras, armazenamento local e comunicação com Google Apps Script.
- `coordenador.js`: fluxo do coordenador.
- `musico.js`: fluxo do músico.
- `apps-script/Code.gs`: API para Google Sheets.
- `data/seed.json`: dados iniciais de exemplo.

## Instalar como app

O projeto está configurado como PWA. Não precisa publicar na Play Store ou App Store:

- Android: abrir o site no Chrome e tocar em `Instalar app` ou `Adicionar à tela inicial`.
- iPhone/iPad: abrir no Safari, tocar em compartilhar e escolher `Adicionar à Tela de Início`.

Link direto para orientar a comunidade:

```text
https://ederbhz.github.io/Agenda-Escala-Mundo-Novo/instalar.html
```

## Rodar localmente

Abra um terminal nesta pasta e rode:

```powershell
python -m http.server 5500
```

Depois acesse:

- `http://localhost:5500/index.html`
- `http://localhost:5500/coordenador.html`
- `http://localhost:5500/musico.html`

A senha inicial do coordenador é `mundo-novo`. Troque em `config.js` antes de publicar.

## Estrutura da planilha

O Apps Script cria e usa estas abas:

- `Musicos`: `id_musico`, `nome`, `telefone`, `email`, `instrumentos`, `status`, `observacoes`
- `Coordenadores`: `id_coordenador`, `nome`, `telefone`, `email`, `status`, `observacoes`
- `FuncoesEscala`: `id_funcao`, `nome_funcao`, `tipo_funcao`, `ordem_exibicao`, `status`
- `Eventos`: `id_evento`, `nome_evento`, `data_evento`, `dia_semana`, `horario`, `local`, `status`, `observacoes`
- `Disponibilidade`: `id_disponibilidade`, `id_musico`, `nome_musico`, `data`, `disponibilidade`, `observacoes`
- `Escala`: um registro por célula preenchida da grade
- `Historico`: confirmação, recusa, remanejamento, cancelamento e alterações importantes
- `Configuracoes`: título, local e horário padrão

## Configurar Google Apps Script

1. Crie ou abra a planilha no Google Sheets.
2. Acesse `Extensões > Apps Script`.
3. Cole o conteúdo de `apps-script/Code.gs`.
4. Troque `ADMIN_KEY = 'troque-esta-chave'` por uma chave forte.
5. Salve o projeto.
6. Rode manualmente a função `setupPlanilhaInicial` uma vez para criar as abas com exemplos.
7. Clique em `Implantar > Nova implantação`.
8. Escolha `Aplicativo da Web`.
9. Em `Executar como`, selecione você.
10. Em `Quem pode acessar`, selecione qualquer pessoa com o link.
11. Copie a URL do Web App.

## Conectar o site à planilha

Opção 1: edite `config.js`:

```js
API_URL: "https://script.google.com/macros/s/SEU_ID/exec",
ADMIN_KEY: "sua-chave",
```

Opção 2: abra `coordenador.html`, expanda `Configuração da API`, cole a URL e a chave, e clique em `Guardar configuração`.

Quando a planilha/API estiver configurada, alterações feitas no coordenador ficam salvas no dispositivo imediatamente e são marcadas como pendentes até `Salvar alterações` confirmar o envio para a planilha. Ao abrir o app novamente, alterações locais pendentes têm prioridade para não serem substituídas por uma planilha antiga.

## Publicar no GitHub Pages

1. Crie um repositório, por exemplo `escala-mundo-novo`.
2. Envie todos os arquivos deste projeto para a branch `main`.
3. No GitHub, acesse `Settings > Pages`.
4. Em `Build and deployment`, selecione `Deploy from a branch`.
5. Escolha a branch `main` e a pasta `/root`.
6. O site ficará em um endereço parecido com:

```text
https://seu-usuario.github.io/escala-mundo-novo/
```

## Fluxo de uso

1. O coordenador entra em `coordenador.html`.
2. Seleciona mês e ano.
3. Clica em `Gerar eventos fixos` para criar Noite de Louvor, Missa Quinta-Feira e as duas Missas Dominicais.
4. Escolhe a semana e preenche a grade escolhendo músicos por função.
5. Clica em `Salvar alterações`.
6. O músico entra em `musico.html`, busca seu nome e confirma ou recusa.
7. Depois da confirmação, o músico pode abrir o evento no Google Agenda ou baixar um arquivo `.ics` para outros calendários.
8. Recusas aparecem em `Pendências`, onde o coordenador remaneja e o histórico é registrado.

## Checklist antes de publicar

- Troque a senha `DEFAULT_ADMIN_PASSWORD` em `config.js`.
- Troque `ADMIN_KEY` em `config.js` e em `apps-script/Code.gs`.
- Publique o Apps Script como Web App e cole a URL em `config.js` ou na tela do coordenador.
- Depois de subir no GitHub Pages, teste os links `coordenador.html` e `musico.html` em uma aba anônima ou em outro dispositivo.
