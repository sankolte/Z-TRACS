// Cross-Node Spatiotemporal Correlation Engine (Model 3)
import { CanonicalEvent } from '../schemas/canonical';
import { GUJARAT_CAMERA_TOPOLOGY } from './TopologyMatrix';

export interface CorrelatedJourney {
  journeyId: string;
  plateNumber: string;
  vehicleType: string;
  sightingsCount: number;
  totalDistanceKm: number;
  averageVelocityKmh: number;
  anprEvents: CanonicalEvent[];
  confidenceScore: number;
}

export class CorrelationEngine {
  static correlatePlateEvents(events: CanonicalEvent[], targetPlate: string): CorrelatedJourney | null {
    const plateEvents = events
      .filter(e => e.vehicle && e.vehicle.plateNumber.toUpperCase() === targetPlate.toUpperCase())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (plateEvents.length === 0) return null;

    let totalKm = 0;
    for (let i = 0; i < plateEvents.length - 1; i++) {
      const fromCode = plateEvents[i].source.cameraCode;
      const toCode = plateEvents[i + 1].source.cameraCode;
      const edge = GUJARAT_CAMERA_TOPOLOGY.find(e => e.fromCameraCode === fromCode && e.toCameraCode === toCode);
      if (edge) {
        totalKm += edge.distanceKm;
      } else {
        totalKm += 15.0; // Estimated fallback inter-node distance
      }
    }

    const firstTime = new Date(plateEvents[0].timestamp).getTime();
    const lastTime = new Date(plateEvents[plateEvents.length - 1].timestamp).getTime();
    const hoursElapsed = Math.max((lastTime - firstTime) / 3600000, 0.1);
    const avgVelocity = Math.round((totalKm / hoursElapsed) * 10) / 10;

    return {
      journeyId: `JRN-${targetPlate}-${Date.now().toString().slice(-4)}`,
      plateNumber: targetPlate,
      vehicleType: plateEvents[0].vehicle?.vehicleType || 'Car',
      sightingsCount: plateEvents.length,
      totalDistanceKm: Math.round(totalKm * 10) / 10,
      averageVelocityKmh: avgVelocity,
      anprEvents: plateEvents,
      confidenceScore: 0.98,
    };
  }
}
