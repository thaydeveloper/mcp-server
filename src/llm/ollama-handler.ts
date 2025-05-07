import fetch from "node-fetch";

interface OllamaConfig {
  name: string;
  type: string;
  model: string;
  description: string;
  capabilities: string[];
}

const OLLAMA_API_URL = "http://localhost:11434/api";

/**
 * Gera texto usando modelo Ollama.
 */
export async function generateWithOllama(
  config: OllamaConfig,
  prompt: string,
  maxTokens: number = 512,
  temperature: number = 0.7
): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt: prompt,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature: temperature,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API Ollama: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error: any) {
    console.error("Erro ao gerar texto com Ollama:", error);
    throw new Error(`Falha ao chamar modelo Ollama: ${error.message}`);
  }
}

/**
 * Obtem embeddings usando modelo Ollama.
 */
export async function getOllamaEmbeddings(
  config: OllamaConfig,
  text: string
): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erro na API Ollama Embeddings: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    return data.embedding;
  } catch (error: any) {
    console.error("Erro ao obter embeddings com Ollama:", error);
    throw new Error(`Falha ao obter embeddings: ${error.message}`);
  }
}
