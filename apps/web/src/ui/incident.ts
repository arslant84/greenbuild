const INCIDENT_ID_LENGTH = 8;

// incidentId is how screens name an attempt: the last characters of its id, upper case ("456789AB").
// Attempt ids are UUIDv7, whose first characters are a timestamp that changes about once a minute, so
// attempts started close together would share them; the last ones are random.
export function incidentId(attemptId: string): string {
  return attemptId.slice(-INCIDENT_ID_LENGTH).toUpperCase();
}
