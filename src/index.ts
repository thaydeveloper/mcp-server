import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import {
  generateWithOllama,
  getOllamaEmbeddings,
} from "./llm/ollama-handler.js";
import { askOllama, listOllamaModels } from "./llm/llm.js";

// Configuração para modelos LLM
interface LLMConfig {
  name: string;
  type?: string;
  model?: string;
  executable?: string;
  args?: string[];
  description: string;
  capabilities: string[];
}

// Carrega configurações LLM de um arquivo JSON
async function loadLLMConfigs(): Promise<LLMConfig[]> {
  try {
    const configPath = path.join(process.cwd(), "llm-config.json");
    const configData = await fs.readFile(configPath, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Erro ao carregar configurações LLM:", error);
    // Configuração padrão se o arquivo não for encontrado
    return [
      {
        name: "llama3.2",
        type: "ollama",
        model: "llama3.2:3b",
        description: "Llama 3.2 3B via Ollama",
        capabilities: ["text-generation", "embeddings"],
      },
    ];
  }
}

// Criar aplicação Express
const app = express();
app.use(express.json());

// Mapa para armazenar transportes por ID de sessão
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Criar o servidor MCP
async function createServer(): Promise<McpServer> {
  const llmConfigs = await loadLLMConfigs();

  const server = new McpServer({
    name: "Ollama-LLM-Server",
    version: "1.0.0",
  });

  // Registrar recursos para informações LLM
  server.resource("llm-list", "llms://list", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(
          llmConfigs.map((config) => ({
            name: config.name,
            description: config.description,
            capabilities: config.capabilities,
          })),
          null,
          2
        ),
      },
    ],
  }));

  // Para cada LLM, criar um recurso específico
  llmConfigs.forEach((config) => {
    server.resource(
      `llm-${config.name}`,
      `llms://${config.name}`,
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                name: config.name,
                description: config.description,
                capabilities: config.capabilities,
              },
              null,
              2
            ),
          },
        ],
      })
    );
  });

  // Registre a ferramenta list-models
  server.tool("list-models", {}, async () => {
    try {
      console.log(
        "Executando ferramenta list-models - buscando modelos do Ollama..."
      );
      const models = await listOllamaModels();
      console.log(`Modelos Ollama encontrados: ${models.length}`);

      // Formatando a resposta de forma mais detalhada
      const modelDetails = models.map((m) => ({
        name: m.name,
        size: `${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        modified: new Date(m.modified_at).toLocaleString(),
        digest: m.digest.substring(0, 10),
      }));

      // Criando uma resposta formatada
      const responseText =
        modelDetails.length > 0
          ? modelDetails
              .map(
                (m) =>
                  `Modelo: ${m.name}\nTamanho: ${m.size}\nModificado: ${m.modified}\nDigest: ${m.digest}...`
              )
              .join("\n\n")
          : "Nenhum modelo encontrado no Ollama.";

      console.log("Resposta da ferramenta list-models preparada com sucesso");
      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error: any) {
      console.error("Erro ao listar modelos Ollama:", error);
      return {
        content: [
          {
            type: "text",
            text: `Erro ao listar modelos: ${error.message}\n\nVerifique se o Ollama está em execução em http://localhost:11434`,
          },
        ],
        isError: true,
      };
    }
  });

  // Ferramenta para gerar texto com um modelo Ollama
  server.tool(
    "generate-text",
    {
      model: z.string().describe("O nome do modelo LLM a ser usado"),
      prompt: z.string().describe("O prompt a ser enviado para o LLM"),
      maxTokens: z
        .number()
        .optional()
        .describe("Número máximo de tokens a serem gerados"),
      temperature: z
        .number()
        .optional()
        .describe("Temperatura para geração de texto"),
    },
    async ({ model, prompt, maxTokens = 512, temperature = 0.7 }) => {
      try {
        const llmConfig = llmConfigs.find((config) => config.name === model);
        if (!llmConfig) {
          return {
            content: [
              { type: "text", text: `Erro: Modelo '${model}' não encontrado` },
            ],
            isError: true,
          };
        }

        // Verificar se o modelo é do tipo Ollama
        if (llmConfig.type === "ollama" && llmConfig.model) {
          // Usar a API Ollama para gerar texto
          const result = await generateWithOllama(
            llmConfig as any,
            prompt,
            maxTokens,
            temperature
          );

          return {
            content: [{ type: "text", text: result }],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Erro: Tipo de modelo '${llmConfig.type}' não suportado`,
              },
            ],
            isError: true,
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Ferramenta para obter embeddings (se suportado pelo modelo)
  server.tool(
    "get-embeddings",
    {
      model: z
        .string()
        .describe("O nome do modelo LLM a ser usado para embeddings"),
      text: z.string().describe("O texto para embeddings"),
    },
    async ({ model, text }) => {
      try {
        const llmConfig = llmConfigs.find((config) => config.name === model);
        if (!llmConfig) {
          return {
            content: [
              { type: "text", text: `Erro: Modelo '${model}' não encontrado` },
            ],
            isError: true,
          };
        }

        if (!llmConfig.capabilities.includes("embeddings")) {
          return {
            content: [
              {
                type: "text",
                text: `Erro: Modelo '${model}' não suporta embeddings`,
              },
            ],
            isError: true,
          };
        }

        // Verificar se o modelo é do tipo Ollama
        if (llmConfig.type === "ollama" && llmConfig.model) {
          // Usar a API Ollama para obter embeddings
          const embeddings = await getOllamaEmbeddings(llmConfig as any, text);
          return {
            content: [{ type: "text", text: JSON.stringify(embeddings) }],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Erro: Tipo de modelo '${llmConfig.type}' não suportado`,
              },
            ],
            isError: true,
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Criar um prompt simples para geração de texto
  server.prompt(
    "text-generation",
    {
      prompt: z.string().describe("O prompt a ser enviado para o LLM"),
      model: z.string().optional().describe("O modelo LLM local a ser usado"),
    },
    ({ prompt, model = llmConfigs[0].name }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: prompt,
          },
        },
      ],
      metadata: {
        model: model,
      },
    })
  );

  return server;
}

// Lidar com requisições POST para comunicação cliente-servidor
app.post("/mcp", async (req, res) => {
  try {
    console.log("Recebendo requisição MCP:", req.body);

    // Verificar ID de sessão existente
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;
    let server: McpServer;

    if (sessionId && transports[sessionId]) {
      // Reutilizar transporte existente
      console.log("Usando transporte existente com ID:", sessionId);
      transport = transports[sessionId];
    } else {
      // Nova requisição - consideramos como inicialização
      console.log("Criando novo transporte para requisição");
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          console.log("Nova sessão inicializada com ID:", sessionId);
          // Armazenar o transporte pelo ID de sessão
          transports[sessionId] = transport;
        },
      });

      // Limpar transporte quando fechado
      transport.onclose = () => {
        if (transport.sessionId) {
          console.log("Fechando sessão com ID:", transport.sessionId);
          delete transports[transport.sessionId];
        }
      };

      // Criar e conectar ao servidor MCP
      server = await createServer();
      await server.connect(transport);

      // Simular a inicialização completa
      if (!isInitializeRequest(req.body)) {
        console.log(
          "Auto-inicializando o servidor para atender requisição não-initialize"
        );

        // No caso de requisições não-init, vamos simplesmente continuar e confiar
        // que o servidor estará pronto para processar a requisição
      }
    }

    // Manipular a requisição - seja initialize ou não
    console.log("Processando requisição MCP");
    await transport.handleRequest(req, res, req.body);
    console.log("Requisição MCP processada");
  } catch (error: any) {
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

// Manipulador reutilizável para requisições GET e DELETE
const handleSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("ID de sessão inválido ou ausente");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Lidar com requisições GET para notificações servidor-cliente via SSE
app.get("/mcp", handleSessionRequest);

// Lidar com requisições DELETE para encerramento de sessão
app.delete("/mcp", handleSessionRequest);

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Servidor MCP para Ollama rodando na porta ${PORT}`);
});
