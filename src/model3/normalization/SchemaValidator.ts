// Canonical Schema Validator (Model 3)
import { CanonicalEvent } from '../schemas/canonical';

export class SchemaValidator {
  static validate(event: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!event) {
      return { valid: false, errors: ['Event payload is null or undefined'] };
    }

    if (!event.eventId) errors.push('Missing event_id');
    if (!event.eventType) errors.push('Missing event_type');
    if (event.schemaVersion !== '1.0') errors.push(`Invalid schema_version: ${event.schemaVersion} (Expected '1.0')`);
    if (!event.timestamp) errors.push('Missing timestamp');

    if (!event.source) {
      errors.push('Missing source block');
    } else {
      if (!event.source.vmsId) errors.push('Missing source.vmsId');
      if (!event.source.cameraCode) errors.push('Missing source.cameraCode');
    }

    if (!event.location) {
      errors.push('Missing location block');
    } else {
      if (typeof event.location.latitude !== 'number') errors.push('Invalid location.latitude');
      if (typeof event.location.longitude !== 'number') errors.push('Invalid location.longitude');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
