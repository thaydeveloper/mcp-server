import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { askOllama, listOllamaModels } from "./llm/llm";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json());

// Criar instância do servidor MCP
const server = new McpServer({
  name: "llm-server",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Registrar todas as ferramentas antes de conectar ao transporte
server.tool(
  "list-models",
  "Lista todos os modelos LLM disponíveis",
  {},
  async () => {
    const models = await listOllamaModels();
    return {
      content: [
        {
          type: "text",
          text: models.map((m) => `Modelo: ${m.name}`).join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "chat",
  "Conversa com um modelo LLM",
  {
    model: z.string().describe("Nome do modelo (ex: llama2)"),
    prompt: z.string().describe("Texto da pergunta"),
  },
  async ({ model, prompt }) => {
    const response = await askOllama(model, prompt);
    return {
      content: [
        {
          type: "text",
          text: response,
        },
      ],
    };
  }
);

// Inicializar o servidor Express primeiro
const PORT = 3000;
const httpServer = app.listen(PORT, () => {
  console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});

// Criar e inicializar o transporte
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// Conectar o servidor MCP ao transporte
server.connect(transport);

// Configurar rota MCP após a conexão estar estabelecida
app.post("/mcp", async (req, res) => {
  console.log("Recebendo requisição MCP:", req.body);
  try {
    // O transport.handleRequest já responde por meio do objeto res
    // Não precisamos enviar uma resposta adicional
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Erro ao processar requisição MCP:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: error?.message || "Erro interno do servidor",
        },
        id: req.body?.id || null,
      });
    }
  }
});

// Rotas REST diretas
app.get("/models", async (_req, res) => {
  try {
    const models = await listOllamaModels();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar modelos" });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { model, prompt } = req.body;
    if (!model || !prompt) {
      res.status(400).json({
        error: "Informe 'model' e 'prompt' no corpo da requisição",
      });
      return;
    }

    const response = await askOllama(model, prompt);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar chat" });
  }
});

// Tratamento de erros global
process.on("uncaughtException", (error) => {
  console.error("Erro não tratado:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promessa não tratada:", promise, "razão:", reason);
});
