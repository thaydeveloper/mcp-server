"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = getAlerts;
exports.getForecast = getForecast;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const llm_1 = require("../llm/llm");
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
// Middleware para tratamento de erros
const asyncHandler = (fn) => {
    return (req, res) => {
        Promise.resolve(fn(req, res)).catch((error) => {
            console.error("Erro:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        });
    };
};
app.post("/mcp", (req, res) => {
    const { tool, input } = req.body;
    (async () => {
        try {
            if (tool === "get-alerts") {
                const result = await getAlerts(input.state);
                res.json(result);
            }
            else if (tool === "get-forecast") {
                const result = await getForecast(input.latitude, input.longitude);
                res.json(result);
            }
            else if (tool === "list-llms") {
                const models = await (0, llm_1.listOllamaModels)();
                res.json({ models });
            }
            else if (tool === "ask-llm") {
                const { model, prompt } = input;
                if (!model || !prompt) {
                    return res.status(400).json({ error: "Informe 'model' e 'prompt'." });
                }
                const response = await (0, llm_1.askOllama)(model, prompt);
                res.json({ response });
            }
            else {
                res.status(400).json({ error: "Ferramenta desconhecida" });
            }
        }
        catch (err) {
            console.error("Erro ao processar requisição:", err);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    })();
});
// Rota específica para listar modelos LLM (sem necessidade de protocolo MCP)
app.get("/llm/models", asyncHandler(async (req, res) => {
    const models = await (0, llm_1.listOllamaModels)();
    res.json({ models });
}));
// Rota específica para chat com LLM (sem necessidade de protocolo MCP)
app.post("/llm/chat", asyncHandler(async (req, res) => {
    const { model, prompt } = req.body;
    if (!model || !prompt) {
        res.status(400).json({
            error: "Informe 'model' e 'prompt' no corpo da requisição",
        });
        return;
    }
    const response = await (0, llm_1.askOllama)(model, prompt);
    res.json({ response });
}));
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
async function makeNWSRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
        return (await response.json());
    }
    catch (error) {
        console.error("Error making NWS request:", error);
        return null;
    }
}
function formatAlert(feature) {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}
async function getAlerts(state) {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);
    if (!alertsData) {
        return {
            content: [{ type: "text", text: "Failed to retrieve alerts data" }],
        };
    }
    const features = alertsData.features || [];
    if (features.length === 0) {
        return {
            content: [{ type: "text", text: `No active alerts for ${stateCode}` }],
        };
    }
    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;
    return { content: [{ type: "text", text: alertsText }] };
}
async function getForecast(latitude, longitude) {
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest(pointsUrl);
    if (!pointsData) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
                },
            ],
        };
    }
    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to get forecast URL from grid point data",
                },
            ],
        };
    }
    const forecastData = await makeNWSRequest(forecastUrl);
    if (!forecastData) {
        return {
            content: [{ type: "text", text: "Failed to retrieve forecast data" }],
        };
    }
    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
        return {
            content: [{ type: "text", text: "No forecast periods available" }],
        };
    }
    const formattedForecast = periods.map((period) => [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
    ].join("\n"));
    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;
    return { content: [{ type: "text", text: forecastText }] };
}
