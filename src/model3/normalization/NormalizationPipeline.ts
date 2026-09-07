// Canonical Normalization Pipeline (Model 3)
import { CanonicalEvent } from '../schemas/canonical';
import { SchemaValidator } from './SchemaValidator';

export class NormalizationPipeline {
  static normalize(rawPayload: Record<string, any>, sourceVmsId: string, cameraCode: string): CanonicalEvent {
    // 1. Raw to Canonical Transformation
    const canonicalEvt: CanonicalEvent = {
      eventId: rawPayload.eventId || `evt-norm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eventType: rawPayload.eventType || 'ANPR_DETECTED',
      schemaVersion: '1.0',
      timestamp: rawPayload.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      source: {
        departmentId: rawPayload.departmentId || 'DEPT-POL-01',
        vmsId: sourceVmsId,
        cameraId: rawPayload.cameraId || `uuid-${cameraCode}`,
        cameraCode: cameraCode,
        connectorId: rawPayload.connectorId || 'conn-normalized',
      },
      location: {
        latitude: rawPayload.latitude || 23.0298,
        longitude: rawPayload.longitude || 72.5074,
        district: rawPayload.district || 'Ahmedabad',
        locationDescription: rawPayload.locationDescription || 'Model 1 Enriched GIS Node',
      },
      detection: {
        objectType: rawPayload.objectType || 'license_plate',
        confidence: rawPayload.confidence || 0.96,
      },
      vehicle: rawPayload.vehicle || {
        plateNumber: rawPayload.plateNumber || 'GJ01AB1234',
        plateConfidence: 98.2,
        vehicleType: 'Car',
        color: 'White',
        speedKmh: 65,
        direction: 'Southbound',
        watchlistFlag: true,
        watchlistReason: 'Crime Branch Flagged Vehicle #8821',
        imageCropUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80',
        vehicleImageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80',
      },
      rawPayload,
      processedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
    };

    // 2. Validate Schema Compliance
    const validation = SchemaValidator.validate(canonicalEvt);
    if (!validation.valid) {
      throw new Error(`Schema Validation Failed: ${validation.errors.join(', ')}`);
    }

    return canonicalEvt;
  }
}
