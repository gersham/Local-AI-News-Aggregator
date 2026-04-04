import { describe, expect, it } from 'vitest';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from './persistence-error';

describe('persistence-error', () => {
  it('recognizes the missing mongodb uri configuration error', () => {
    expect(
      isMongoPersistenceConfigurationError(
        new Error('MONGODB_URI is required for MongoDB-backed persistence.'),
      ),
    ).toBe(true);
    expect(
      isMongoPersistenceConfigurationError(new Error('Something else failed.')),
    ).toBe(false);
  });

  it('returns a human-readable setup message', () => {
    expect(getMongoPersistenceSetupMessage()).toContain('MONGODB_URI');
  });
});
