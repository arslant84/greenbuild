const INCIDENT_ID_LENGTH = 8;

// incidentId is how screens name an attempt: the first characters of its id, upper case ("01A176FB").
export function incidentId(attemptId: string): string {
  return attemptId.slice(0, INCIDENT_ID_LENGTH).toUpperCase();
}
