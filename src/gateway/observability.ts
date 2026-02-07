import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

// Configurable via env vars
const METRICS_PORT = parseInt(process.env.OTEL_METRICS_PORT || "9464", 10);

let sdk: NodeSDK | null = null;

export function initObservability() {
  if (process.env.DISABLE_OBSERVABILITY === "true") {
    return;
  }

  const exporter = new PrometheusExporter({
    port: METRICS_PORT,
    endpoint: "/metrics",
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "moltbot-gateway",
      [SemanticResourceAttributes.SERVICE_VERSION]: "2026.2.4",
    }),
    metricReader: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy instrumentations if needed
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    console.log(
      `[Observability] Started. Prometheus metrics available on port ${METRICS_PORT}/metrics`,
    );

    // Graceful shutdown handled by NodeSDK implicitly for some signals, but explicit is better for custom logic
    const shutdown = async () => {
      if (sdk) {
        try {
          await sdk.shutdown();
          console.log("[Observability] SDK shut down successfully");
        } catch (error) {
          console.error("[Observability] Error shutting down SDK", error);
        }
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("[Observability] Failed to start:", error);
  }
}
