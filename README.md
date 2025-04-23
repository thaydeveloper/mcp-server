# MCP Server em TypeScript

Este projeto implementa um servidor compatível com o Model Context Protocol (MCP).

## Rodando localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Rode em modo desenvolvimento:
   ```bash
   npm run dev
   ```
3. Para build e execução em produção:
   ```bash
   npm run build
   npm start
   ```

## Usando Docker

1. Construa a imagem:
   ```bash
   docker build -t mcp-server .
   ```
2. Rode o container:
   ```bash
   docker run -p 3000:3000 mcp-server
   ```

O servidor estará disponível em http://localhost:3000.

## Endpoints MCP

- `GET /v1/models`: Lista os modelos disponíveis
- `POST /v1/completions`: Gera uma resposta de exemplo

Para mais informações sobre MCP: [Model Context Protocol](https://modelcontextprotocol.io/llms-full.txt)
