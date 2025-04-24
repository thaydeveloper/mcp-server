import express from "express";
import bodyParser from "body-parser";
import { askOllama, listOllamaModels } from "../llm/llm";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

const app = express();
app.use(bodyParser.json());

app.post("/mcp", async (req, res) => {
  const { tool, input } = req.body;

  try {
    if (tool === "get-alerts") {
      const result = await getAlerts(input.state);
      res.json(result);
    } else if (tool === "get-forecast") {
      const result = await getForecast(input.latitude, input.longitude);
      res.json(result);
    } else if (tool === "list-llms") {
      const models = await listOllamaModels();
      res.json({ models });
    } else if (tool === "ask-llm") {
      const { model, prompt } = input;
      if (!model || !prompt) {
        return res.status(400).json({ error: "Informe 'model' e 'prompt'." });
      }
      const response = await askOllama(model, prompt);
      res.json({ response });
    } else {
      res.status(400).json({ error: "Ferramenta desconhecida" });
    }
  } catch (err) {
   console.error("Erro ao processar requisição:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.listen(3000, () => {
  console.log("Servidor HTTP MCP rodando em http://localhost:3000/mcp");
});

async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

function formatAlert(feature: AlertFeature): string {
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

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

export async function getAlerts(state: string) {
  const stateCode = state.toUpperCase();
  const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
  const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);
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

export async function getForecast(latitude: number, longitude: number) {
  const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);
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
  const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
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
  const formattedForecast = periods.map((period: ForecastPeriod) =>
    [
      `${period.name || "Unknown"}:`,
      `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
      `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
      `${period.shortForecast || "No forecast available"}`,
      "---",
    ].join("\n")
  );
  const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;
  return { content: [{ type: "text", text: forecastText }] };
}