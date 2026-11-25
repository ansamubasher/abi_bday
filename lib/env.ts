const DEV_DEFAULTS: Record<string, string> = {
  SESSION_SECRET: "dev-session-secret-not-for-production-1234567890",
  LETTER_SECRET: "dev-letter-secret-not-for-production-1234567890",
  HERO_CODE: "lantern",
  ADMIN_CODE: "organiser",
};

export function env(name: keyof typeof DEV_DEFAULTS): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return DEV_DEFAULTS[name];
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}
