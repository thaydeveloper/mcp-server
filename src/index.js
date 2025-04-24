"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const server = new mcp_js_1.McpServer({
    name: "weather",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});
function makeNWSRequest(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = {
            "User-Agent": USER_AGENT,
            Accept: "application/geo+json",
        };
        try {
            const response = yield fetch(url, { headers });
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
            return (yield response.json());
        }
        catch (error) {
            console.error("Error making NWS request:", error);
            return null;
        }
    });
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
server.tool("get-alerts", "Get weather alerts for a state", {
    state: zod_1.z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ state }) {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = yield makeNWSRequest(alertsUrl);
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
}));
server.tool("get-forecast", "Get weather forecast for a location", {
    latitude: zod_1.z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: zod_1.z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location"),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ latitude, longitude }) {
    var _b, _c;
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = yield makeNWSRequest(pointsUrl);
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
    const forecastUrl = (_b = pointsData.properties) === null || _b === void 0 ? void 0 : _b.forecast;
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
    const forecastData = yield makeNWSRequest(forecastUrl);
    if (!forecastData) {
        return {
            content: [{ type: "text", text: "Failed to retrieve forecast data" }],
        };
    }
    const periods = ((_c = forecastData.properties) === null || _c === void 0 ? void 0 : _c.periods) || [];
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
}));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const transport = new stdio_js_1.StdioServerTransport();
        yield server.connect(transport);
        console.error("Weather MCP Server running on stdio");
    });
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
