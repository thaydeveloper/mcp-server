import fs from "fs";
import path from "path";
import { ModelConfig } from "../types";

// Carrega configurações dos modelos do arquivo llm-config.json
export const loadModelConfigs = (): ModelConfig[] => {
  try {
    const configPath = path.resolve(process.cwd(), "llm-config.json");
    const configData = fs.readFileSync(configPath, "utf8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Erro ao carregar configurações dos modelos:", error);
    return [];
  }
};

// URL base do Ollama
export const OLLAMA_BASE_URL =
  process.env.OLLAMA_URL || "http://localhost:11434";
