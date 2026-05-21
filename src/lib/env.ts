export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  OTP_SECRET: process.env.OTP_SECRET,
};

export function getRequiredEnv(name: keyof typeof process.env): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function isProduction(): boolean {
  return env.NODE_ENV === "production";
}
