import {
  clearActivityLogs as clearActivityLogsFromMongo,
  loadActivityLogs as loadActivityLogsFromMongo,
} from '@news-aggregator/core';

export async function loadActivityLogs(
  options: {
    dbName?: string;
    limit?: number;
    severity?: string;
    since?: string;
    source?: string;
    uri?: string;
  } = {},
) {
  return loadActivityLogsFromMongo({
    dbName: options.dbName,
    limit: options.limit,
    severity: options.severity,
    since: options.since,
    source: options.source,
    uri: options.uri,
  });
}

export async function clearActivityLogs(
  options: { dbName?: string; uri?: string } = {},
) {
  return clearActivityLogsFromMongo({
    dbName: options.dbName,
    uri: options.uri,
  });
}
