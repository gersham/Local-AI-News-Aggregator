const mongoUriMissingMessage =
  'MONGODB_URI is required for MongoDB-backed persistence.';

export function isMongoPersistenceConfigurationError(error: unknown) {
  return (
    error instanceof Error && error.message.includes(mongoUriMissingMessage)
  );
}

export function getMongoPersistenceSetupMessage() {
  return 'MongoDB is not configured. Add MONGODB_URI to .env and restart the web app.';
}
