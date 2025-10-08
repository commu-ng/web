import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";

export async function configureLogger() {
  await configure({
    sinks: {
      sentry: getSentrySink(),
      console: getConsoleSink(),
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
      },
      { category: [], sinks: ["sentry", "console"], lowestLevel: "debug" },
    ],
  });
}

// Pre-configured loggers for common use cases
export const logger = {
  http: getLogger(["commu-ng", "api", "http"]),
  service: getLogger(["commu-ng", "api", "service"]),
  middleware: getLogger(["commu-ng", "api", "middleware"]),
  db: getLogger(["commu-ng", "api", "db"]),
};
