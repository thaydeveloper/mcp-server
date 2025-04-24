
export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
  details?: any;
}

export interface OllamaListResponse {
  models: OllamaModel[];
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: any;
}

const OLLAMA_BASE_URL = "http://localhost:11434";

/**
 * Lista todos os modelos disponíveis no Ollama.
 */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!res.ok) throw new Error("Erro ao listar modelos do Ollama");
  const data: OllamaListResponse = await res.json();
  return data.models;
}

/**
 * Envia um prompt para um modelo LLM do Ollama e retorna a resposta.
 * @param model Nome do modelo (ex: "llama3")
 * @param prompt Texto da pergunta
 * @param options Parâmetros opcionais para ajuste fino do modelo
 */
export async function askOllama(
  model: string,
  prompt: string,
  options: Partial<{
    num_predict: number;
    temperature: number;
    top_p: number;
    top_k: number;
    stop: string[];
  }> = {}
): Promise<string> {
  // Parâmetros padrão otimizados para velocidade e controle de resposta
  const defaultOptions = {
    num_predict: 128,        // Menos tokens = resposta mais rápida
    temperature: 0.5,       // Mais determinístico, mas ainda criativo
    top_p: 0.9,             // Nucleus sampling
    top_k: 40,              // Top-k sampling
    ...options
  };

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: defaultOptions
    }),
  });
  if (!res.ok) throw new Error("Erro ao consultar modelo Ollama");
  const data = await res.json();
  return data.response;
}