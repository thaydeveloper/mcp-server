"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const ollama_handler_1 = __importDefault(require("./llm/ollama-handler"));
const uuid_1 = require("uuid");
// Carrega variáveis de ambiente
dotenv_1.default.config();
// Configurações do servidor
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(body_parser_1.default.json());
// Verifica se o servidor Ollama está disponível
(async () => {
    const isOllamaAvailable = await ollama_handler_1.default.healthCheck();
    if (!isOllamaAvailable) {
        console.error("ERRO: Servidor Ollama não está disponível. Verifique se o Ollama está rodando em", process.env.OLLAMA_URL || "http://localhost:11434");
        process.exit(1);
    }
    console.log("Servidor Ollama disponível. Iniciando MCP Server...");
})();
// Configura as rotas MCP
const httpServer = (0, http_1.createServer)(app);
// Rota para listar modelos (compatível com MCP)
app.get("/v1/models", (_req, res) => {
    const models = ollama_handler_1.default.getModels();
    // Formata resposta no padrão MCP
    const mcpResponse = {
        object: "list",
        data: models.map((model) => ({
            id: model.name,
            object: "model",
            created: Date.now(),
            owned_by: "local",
            capabilities: model.capabilities,
            description: model.description,
        })),
    };
    res.json(mcpResponse);
});
// Rota para completions (compatível com MCP)
app.post("/v1/completions", async (req, res) => {
    try {
        const request = req.body;
        if (!request.model || !request.prompt) {
            return res.status(400).json({
                error: {
                    message: "Os parâmetros model e prompt são obrigatórios",
                    type: "invalid_request_error",
                },
            });
        }
        // Verifica se o modelo existe
        if (!ollama_handler_1.default.getModelByName(request.model)) {
            return res.status(404).json({
                error: {
                    message: `Modelo "${request.model}" não encontrado`,
                    type: "invalid_request_error",
                    param: "model",
                },
            });
        }
        // Chama o serviço Ollama para gerar completion
        const ollamaResponse = await ollama_handler_1.default.generateCompletion(request);
        // Formata resposta no padrão MCP
        const mcpResponse = {
            id: (0, uuid_1.v4)(),
            object: "completion",
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
                {
                    text: ollamaResponse.response,
                    index: 0,
                    finish_reason: ollamaResponse.done ? "stop" : "length",
                },
            ],
        };
        res.json(mcpResponse);
    }
    catch (error) {
        console.error("Erro ao gerar completion:", error);
        res.status(500).json({
            error: {
                message: error.message || "Erro ao gerar completion",
                type: "server_error",
            },
        });
    }
});
// Verifica se um modelo está disponível
app.get("/api/model/:modelName", (req, res) => {
    const { modelName } = req.params;
    const model = ollama_handler_1.default.getModelByName(modelName);
    if (model) {
        res.json({
            available: true,
            model: {
                name: model.name,
                id: model.model,
                capabilities: model.capabilities,
            },
        });
    }
    else {
        res.status(404).json({ available: false, error: "Modelo não encontrado" });
    }
});
// Rota para verificar o status
app.get("/api/health", (_req, res) => {
    res.json({
        status: "online",
        message: "MCP Server para Ollama está funcionando",
        time: new Date().toISOString(),
    });
});
// Rota raiz
app.get("/", (_req, res) => {
    res.json({
        status: "online",
        message: "MCP Server para Ollama está funcionando",
        endpoints: {
            models: "/v1/models",
            completions: "/v1/completions",
        },
    });
});
// Inicia o servidor
httpServer.listen(PORT, () => {
    console.log(`Servidor MCP rodando em http://localhost:${PORT}`);
    console.log(`Modelos disponíveis: ${ollama_handler_1.default
        .getModels()
        .map((m) => m.name)
        .join(", ")}`);
});
