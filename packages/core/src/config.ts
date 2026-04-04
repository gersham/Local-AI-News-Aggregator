import { z } from 'zod';
import { sourceDefinitionSchema } from './domain';

export const runtimeEnvSchema = z.object({
  APP_BASE_URL: z.url(),
  MORNING_BRIEFING_TIME: z.string().regex(/^\d{2}:\d{2}$/),
  MORNING_BRIEFING_TIMEZONE: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).optional(),
  XAI_API_KEY: z.string().min(1),
  EXA_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  SONOS_TARGET_ROOM: z.string().min(1),
  SONOS_TARGET_HOST: z.string().optional(),
  AUDIO_HOST_BASE_URL: z.url(),
  REDDIT_AUTOMATION_SESSION_NAME: z
    .string()
    .min(1)
    .default('news-aggregator-reddit'),
  CHROME_DEBUG_URL: z.string().optional(),
  X_USERNAME: z.string().optional(),
  X_PASSWORD: z.string().optional(),
  REDDIT_USERNAME: z.string().optional(),
  REDDIT_PASSWORD: z.string().optional(),
  SONOS_HOUSEHOLD_NAME: z.string().optional(),
  ELEVENLABS_PRIMARY_VOICE_ID: z.string().optional(),
  ELEVENLABS_SECONDARY_VOICE_ID: z.string().optional(),
  ELEVENLABS_TERTIARY_VOICE_ID: z.string().optional(),
});

export const sourceRegistrySchema = z.object({
  sources: z.array(sourceDefinitionSchema),
});

export function loadRuntimeConfig(input: Record<string, string | undefined>) {
  const env = runtimeEnvSchema.parse(input);

  return {
    app: {
      baseUrl: env.APP_BASE_URL,
      audioHostBaseUrl: env.AUDIO_HOST_BASE_URL,
    },
    briefing: {
      time: env.MORNING_BRIEFING_TIME,
      timezone: env.MORNING_BRIEFING_TIMEZONE,
    },
    providers: {
      xai: {
        apiKey: env.XAI_API_KEY,
      },
      exa: {
        apiKey: env.EXA_API_KEY,
      },
      elevenLabs: {
        apiKey: env.ELEVENLABS_API_KEY,
        primaryVoiceId: env.ELEVENLABS_PRIMARY_VOICE_ID,
        secondaryVoiceId: env.ELEVENLABS_SECONDARY_VOICE_ID,
        tertiaryVoiceId: env.ELEVENLABS_TERTIARY_VOICE_ID,
      },
    },
    database: {
      dbName: env.MONGODB_DB_NAME,
      uri: env.MONGODB_URI,
    },
    sonos: {
      targetHost: env.SONOS_TARGET_HOST,
      targetRoom: env.SONOS_TARGET_ROOM,
      householdName: env.SONOS_HOUSEHOLD_NAME,
    },
    browser: {
      redditSessionName: env.REDDIT_AUTOMATION_SESSION_NAME,
      redditUsername: env.REDDIT_USERNAME,
      redditPassword: env.REDDIT_PASSWORD,
      chromeDebugUrl: env.CHROME_DEBUG_URL,
      xUsername: env.X_USERNAME,
      xPassword: env.X_PASSWORD,
    },
  };
}

export function parseSourceRegistry(input: unknown) {
  return sourceRegistrySchema.parse(input);
}

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type SourceRegistry = z.infer<typeof sourceRegistrySchema>;
