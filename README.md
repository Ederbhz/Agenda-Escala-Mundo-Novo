# Escala de Música - Comunidade Mundo Novo

Aplicação estática para montar e divulgar a escala dos músicos da Comunidade Mundo Novo.

## O que já vem pronto

- Página pública para divulgação: `#/public`
- Página administrativa para montar a escala: `#/admin`
- Dados iniciais baseados na planilha atual de junho/2026
- Filtro por músico e por evento
- Edição de datas, eventos, instrumentos, integrantes e observações
- Exportação da escala em JSON
- Integração opcional com Google Apps Script para salvar em uma planilha

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `escala-mundo-novo`.
2. Envie todos os arquivos deste projeto para o repositório.
3. No GitHub, entre em `Settings > Pages`.
4. Em `Build and deployment`, selecione `Deploy from a branch`.
5. Escolha a branch `main` e a pasta `/root`.
6. O link público ficará parecido com:

```text
https://seu-usuario.github.io/escala-mundo-novo/#/public
```

O link administrativo ficará parecido com:

```text
https://seu-usuario.github.io/escala-mundo-novo/#/admin
```

Com backend configurado, use o parâmetro `api` no link de divulgação:

```text
https://seu-usuario.github.io/escala-mundo-novo/?api=URL_DO_APPS_SCRIPT#/public
```

## Persistência com Google Apps Script

Sem backend, a página administrativa salva as alterações somente no navegador de quem editou. Para publicar a escala para todos os músicos, use o Apps Script:

1. Abra a planilha no Google Sheets.
2. Vá em `Extensões > Apps Script`.
3. Cole o conteúdo de `apps-script/Code.gs`.
4. Troque o valor de `ADMIN_KEY` por uma chave forte.
5. Clique em `Implantar > Nova implantação`.
6. Escolha o tipo `Aplicativo da Web`.
7. Em `Executar como`, selecione você.
8. Em `Quem pode acessar`, selecione qualquer pessoa com o link.
9. Copie a URL da implantação.
10. Abra `#/admin`, informe a URL do backend e a chave administrativa.
11. Clique em `Publicar no backend`.

Depois disso, a escala publicada pode ser carregada por qualquer pessoa pela página pública.

## Estrutura dos dados

A escala fica em JSON com esta forma:

```json
{
  "title": "Escala Banda MN - Junho de 2026",
  "notice": "A escala poderá sofrer alterações no decorrer do mês.",
  "instruments": ["Baixo", "Batera", "Violão", "Guitarra", "Teclado"],
  "events": [
    {
      "id": "domingo-2026-06-14",
      "name": "Domingo",
      "date": "2026-06-14",
      "assignments": {
        "Baixo": "Eder",
        "Batera": "Igor",
        "Violão": "Junio",
        "Guitarra": "",
        "Teclado": "Emerson"
      }
    }
  ],
  "members": {
    "Baixo": ["Eder", "Daniel"]
  },
  "notes": "Observações de disponibilidade"
}
```

## Próximas melhorias sugeridas

- Login real para administradores
- Histórico de alterações
- Geração automática de escala respeitando indisponibilidades
- Confirmação do músico por WhatsApp
- Importação direta da planilha atual
