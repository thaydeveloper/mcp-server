import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  console.log("Conectando ao servidor MCP...");

  // Criar cliente MCP
  const client = new Client({
    name: "example-client",
    version: "1.0.0",
  });

  // Conectar ao servidor
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/mcp")
  );

  try {
    await client.connect(transport);
    console.log("Conectado com sucesso!");

    // Listar recursos disponíveis
    console.log("\nListando recursos disponíveis:");
    const resources = await client.listResources();
    console.log(resources);

    // Ler a lista de ferramentas
    console.log("\nObtendo lista de ferramentas:");
    const tools = await client.listTools();
    console.log(tools);

    // Executando a ferramenta generate-text
    console.log("\nExecutando a ferramenta generate-text:");
    try {
      const result = await client.callTool({
        name: "generate-text",
        arguments: {
          model: "llama3.2", // Usando o modelo Llama 3.2 do Ollama
          prompt: "Explique brevemente como funcionam os modelos de linguagem:",
        },
      });

      console.log("Resposta da ferramenta generate-text:");
      if (
        result &&
        typeof result === "object" &&
        "content" in result &&
        Array.isArray(result.content) &&
        result.content.length > 0 &&
        typeof result.content[0] === "object" &&
        "text" in result.content[0]
      ) {
        console.log(result.content[0].text);
      } else {
        console.log("Formato de resposta inesperado:", result);
      }
    } catch (error) {
      console.error("Erro ao executar generate-text:", error);
    }

    // Executando a ferramenta get-embeddings
    console.log("\nExecutando a ferramenta get-embeddings:");
    try {
      const embeddingsResult = await client.callTool({
        name: "get-embeddings",
        arguments: {
          model: "llama3.2", // Usando o modelo Llama 3.2 do Ollama
          text: "Modelos de linguagem são fascinantes",
        },
      });

      console.log("Resposta da ferramenta get-embeddings:");
      console.log(embeddingsResult);
    } catch (error) {
      console.error("Erro ao executar get-embeddings:", error);
    }
  } catch (error) {
    console.error("Erro ao interagir com o servidor MCP:", error);
  } finally {
    // Fechar a conexão
    await transport.close();
    console.log("\nConexão fechada.");
  }
}

main();
