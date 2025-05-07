import fetch from "node-fetch";

async function main() {
  const ENDPOINT = "http://localhost:3000/mcp";
  let sessionId: string | null = null;

  console.log("=== CLIENTE DE TESTE PARA SERVIDOR MCP ===");

  // 1. Inicializando o servidor MCP
  console.log("\n1. Enviando requisição de inicialização...");

  try {
    // Adicionando cabeçalhos adequados para evitar erro 406
    // O servidor espera que o cliente aceite tanto application/json quanto text/event-stream
    const initResponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "init-" + Date.now(),
        method: "initialize",
        params: {
          client: {
            name: "Test-Client",
            version: "1.0.0",
          },
          capabilities: {},
        },
      }),
    });

    // Capturar e mostrar detalhes em caso de erro HTTP
    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error(
        `Erro HTTP ${initResponse.status}: ${initResponse.statusText}`
      );
      console.error(`Detalhes da resposta: ${errorText}`);
      throw new Error(`HTTP error! Status: ${initResponse.status}`);
    }

    const initData = await initResponse.json();
    console.log(
      "Resposta de inicialização:",
      JSON.stringify(initData, null, 2)
    );

    // Extrair session ID do cabeçalho de resposta
    sessionId = initResponse.headers.get("mcp-session-id");
    console.log("ID de sessão obtido:", sessionId);

    if (!sessionId) {
      throw new Error("Não foi possível obter ID de sessão");
    }

    // 2. Listar modelos disponíveis
    console.log("\n2. Listando modelos disponíveis...");

    const listModelsResponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "list-" + Date.now(),
        method: "tool/invoke",
        params: {
          name: "list-models",
        },
      }),
    });

    // Capturar e mostrar detalhes em caso de erro HTTP
    if (!listModelsResponse.ok) {
      const errorText = await listModelsResponse.text();
      console.error(
        `Erro HTTP ${listModelsResponse.status}: ${listModelsResponse.statusText}`
      );
      console.error(`Detalhes da resposta: ${errorText}`);
      throw new Error(`HTTP error! Status: ${listModelsResponse.status}`);
    }

    const listModelsData = await listModelsResponse.json();
    console.log(
      "Resposta da listagem de modelos:",
      JSON.stringify(listModelsData, null, 2)
    );

    // 3. Gerar texto usando o modelo llama3.2
    console.log("\n3. Gerando texto com o modelo llama3.2...");

    const generateResponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "generate-" + Date.now(),
        method: "tool/invoke",
        params: {
          name: "generate-text",
          arguments: {
            model: "llama3.2",
            prompt: "Explique o que é inteligência artificial em duas frases.",
          },
        },
      }),
    });

    // Capturar e mostrar detalhes em caso de erro HTTP
    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error(
        `Erro HTTP ${generateResponse.status}: ${generateResponse.statusText}`
      );
      console.error(`Detalhes da resposta: ${errorText}`);
      throw new Error(`HTTP error! Status: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();
    console.log(
      "Resposta da geração de texto:",
      JSON.stringify(generateData, null, 2)
    );
  } catch (error) {
    console.error("Erro:", error);
  }
}

main();
