"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const llm_1 = require("./llm/llm");
const node_crypto_1 = require("node:crypto");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Criar instância do servidor MCP
const server = new mcp_js_1.McpServer({
    name: "llm-server",
    version: "1.0.0",
    capabilities: {
        tools: {},
    },
});
// Registrar todas as ferramentas antes de conectar ao transporte
server.tool("list-models", "Lista todos os modelos LLM disponíveis", {}, async () => {
    const models = await (0, llm_1.listOllamaModels)();
    return {
        content: [
            {
                type: "text",
                text: models.map((m) => `Modelo: ${m.name}`).join("\n"),
            },
        ],
    };
});
server.tool("chat", "Conversa com um modelo LLM", {
    model: zod_1.z.string().describe("Nome do modelo (ex: llama2)"),
    prompt: zod_1.z.string().describe("Texto da pergunta"),
}, async ({ model, prompt }) => {
    const response = await (0, llm_1.askOllama)(model, prompt);
    return {
        content: [
            {
                type: "text",
                text: response,
            },
        ],
    };
});
// Inicializar o servidor Express primeiro
const PORT = 3000;
const httpServer = app.listen(PORT, () => {
    console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});
// Criar e inicializar o transporte
const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
    sessionIdGenerator: () => (0, node_crypto_1.randomUUID)(),
});
// Conectar o servidor MCP ao transporte
server.connect(transport);
// Configurar rota MCP após a conexão estar estabelecida
app.post("/mcp", async (req, res) => {
    console.log("Recebendo requisição MCP:", req.body);
    try {
        const response = await transport.handleRequest(req, res, req.body);
        console.log("Requisição MCP processada com sucesso:", response);
        // Se a resposta não foi enviada e temos uma resposta válida
        if (!res.headersSent) {
            const jsonRpcResponse = {
                jsonrpc: "2.0",
                id: req.body.id,
                result: { content: [] },
            };
            res.json(jsonRpcResponse);
        }
    }
    catch (error) {
        console.error("Erro ao processar requisição MCP:", error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: error || "Erro interno do servidor",
                },
                id: req.body?.id || null,
            });
        }
    }
});
// Rotas REST diretas
app.get("/models", async (_req, res) => {
    try {
        const models = await (0, llm_1.listOllamaModels)();
        res.json({ models });
    }
    catch (error) {
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
        const response = await (0, llm_1.askOllama)(model, prompt);
        res.json({ response });
    }
    catch (error) {
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
