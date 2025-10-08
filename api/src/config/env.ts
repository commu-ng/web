/**
 * Centralized environment variable configuration
 * All environment variables should be accessed through this file
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] || defaultValue;
}

export const env = {
  // Server
  port: Number(getOptionalEnv("PORT", "3000")),

  // Database
  databaseUrl: getEnv("DATABASE_URL"),

  // Domain
  consoleDomain: getEnv("CONSOLE_DOMAIN"),

  // R2 Storage
  r2: {
    endpointUrl: getEnv("R2_ENDPOINT_URL"),
    accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    bucketName: getEnv("R2_BUCKET_NAME"),
    publicUrl: getEnv("R2_PUBLIC_URL"),
  },

  // Email (Mailgun)
  mailgun: {
    apiKey: getEnv("MAILGUN_API_KEY"),
    domain: getEnv("MAILGUN_DOMAIN"),
  },

  // Monitoring
  sentry: {
    dsn: getOptionalEnv("SENTRY_DSN"),
  },
} as const;
