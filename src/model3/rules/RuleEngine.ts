// Configurable Rule Engine (Model 3)
import { CanonicalEvent } from '../schemas/canonical';
import { SystemAlert } from '../../types';

export class RuleEngine {
  static evaluate(event: CanonicalEvent): SystemAlert | null {
    // Rule 1: Crime Branch Watchlist Plate Match
    if (event.vehicle && event.vehicle.watchlistFlag) {
      return {
        id: `alt-rule-${Date.now()}`,
        title: `WATCHLIST MATCH: ${event.vehicle.plateNumber} Detected`,
        severity: 'CRITICAL',
        category: 'WATCHLIST_MATCH',
        status: 'NEW',
        timestamp: event.timestamp,
        cameraUuid: event.source.cameraId,
        cameraCode: event.source.cameraCode,
        cameraName: event.location.locationDescription,
        district: event.location.district,
        plateNumber: event.vehicle.plateNumber,
        notes: `RuleEngine Matched Watchlist Entry. Reason: ${event.vehicle.watchlistReason || 'Crime Branch Flagged'}`,
      };
    }

    // Rule 2: Speed Violation (> 80 Km/h)
    if (event.vehicle && event.vehicle.speedKmh > 80) {
      return {
        id: `alt-rule-speed-${Date.now()}`,
        title: `SPEED VIOLATION: ${event.vehicle.plateNumber} (${event.vehicle.speedKmh} Km/h)`,
        severity: 'HIGH',
        category: 'SPEED_VIOLATION',
        status: 'NEW',
        timestamp: event.timestamp,
        cameraUuid: event.source.cameraId,
        cameraCode: event.source.cameraCode,
        cameraName: event.location.locationDescription,
        district: event.location.district,
        plateNumber: event.vehicle.plateNumber,
        notes: `Vehicle exceeded urban corridor speed limit of 60 Km/h by ${event.vehicle.speedKmh - 60} Km/h`,
      };
    }

    return null;
  }
}
