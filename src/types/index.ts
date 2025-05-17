// Tipos para o sistema MCP

export interface ModelConfig {
  name: string;
  type: string;
  model: string;
  description: string;
  capabilities: string[];
}

export interface OllamaCompletionRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
    stop?: string[];
  };
}

export interface OllamaCompletionResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface MCPCompletionRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
}

export interface MCPCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    finish_reason: string;
  }[];
}

export interface MCPError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface MCPModelsResponse {
  object: string;
  data: {
    id: string;
    object: string;
    created: number;
    owned_by: string;
    capabilities: string[];
    description: string;
  }[];
}
