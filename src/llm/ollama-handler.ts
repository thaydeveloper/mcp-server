import fetch from "node-fetch";
import { OLLAMA_BASE_URL, loadModelConfigs } from "../config/ollama";
import {
  ModelConfig,
  OllamaCompletionRequest,
  OllamaCompletionResponse,
  MCPCompletionRequest,
} from "../types";

class OllamaService {
  private modelConfigs: ModelConfig[];

  constructor() {
    this.modelConfigs = loadModelConfigs();
  }

  // Retorna todos os modelos configurados
  getModels(): ModelConfig[] {
    return this.modelConfigs;
  }

  // Busca um modelo específico por nome
  getModelByName(name: string): ModelConfig | undefined {
    return this.modelConfigs.find((model) => model.name === name);
  }

  // Verifica se o Ollama está funcionando
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      return response.ok;
    } catch (error) {
      console.error("Erro ao verificar a disponibilidade do Ollama:", error);
      return false;
    }
  }

  // Gera completions usando o Ollama API
  async generateCompletion(
    request: MCPCompletionRequest
  ): Promise<OllamaCompletionResponse> {
    const modelConfig = this.getModelByName(request.model);

    if (!modelConfig) {
      throw new Error(`Modelo "${request.model}" não encontrado`);
    }

    const ollamaRequest: OllamaCompletionRequest = {
      model: modelConfig.model,
      prompt: request.prompt,
      stream: false, // Definindo explicitamente como false para não usar streaming
      options: {
        temperature: request.temperature,
        top_p: request.top_p,
        max_tokens: request.max_tokens,
        stop: request.stop,
      },
    };

    try {
      console.log("Enviando requisição para Ollama:", JSON.stringify(ollamaRequest, null, 2));
      
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ollamaRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Resposta de erro do Ollama:", errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(`Erro na API Ollama: ${errorData.error || response.statusText}`);
        } catch (e) {
          throw new Error(`Erro na API Ollama: ${errorText || response.statusText}`);
        }
      }

      // Lê o corpo da resposta como texto
      const responseText = await response.text();
      console.log("Resposta do Ollama (text):", responseText);
      
      try {
        // Tenta fazer o parse do JSON
        const responseJson = JSON.parse(responseText);
        return responseJson as OllamaCompletionResponse;
      } catch (err) {
        console.error("Erro ao fazer parse do JSON da resposta:", err);
        
        // Se falhar no parse, verifica se a resposta é um conjunto de JSONs por linha
        if (responseText.includes('\n')) {
          // Pega a última linha não vazia que deve conter o estado final
          const lines = responseText.split('\n').filter(line => line.trim().length > 0);
          const lastLine = lines[lines.length - 1];
          
          try {
            const finalResponse = JSON.parse(lastLine);
            return finalResponse as OllamaCompletionResponse;
          } catch (e) {
            console.error("Erro ao processar a última linha da resposta:", e);
            throw new Error("Não foi possível processar a resposta do Ollama");
          }
        }
        
        // Se não conseguir processar, cria uma resposta básica
        return {
          model: modelConfig.model,
          created_at: new Date().toISOString(),
          response: responseText,
          done: true
        };
      }
    } catch (error) {
      console.error("Erro ao chamar Ollama API:", error);
      throw error;
    }
  }
}

export default new OllamaService();
