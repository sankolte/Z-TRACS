// Gujarat Camera Network Topology Matrix (Model 3)
import { TopologyEdge } from '../schemas/canonical';

export const GUJARAT_CAMERA_TOPOLOGY: TopologyEdge[] = [
  {
    fromCameraCode: 'CAM-GJ-AHM-TRF-000001',
    toCameraCode: 'CAM-GJ-AHM-MNC-000042',
    distanceKm: 8.4,
    expectedTravelTimeMins: 12,
    corridorName: 'SG Highway -> Sabarmati Riverfront Promenade',
  },
  {
    fromCameraCode: 'CAM-GJ-AHM-MNC-000042',
    toCameraCode: 'CAM-GJ-SUR-TRF-001092',
    distanceKm: 262.0,
    expectedTravelTimeMins: 210,
    corridorName: 'NE-1 National Expressway -> Surat Ring Road',
  },
  {
    fromCameraCode: 'CAM-GJ-SUR-TRF-001092',
    toCameraCode: 'CAM-GJ-VAD-TRN-000511',
    distanceKm: 154.0,
    expectedTravelTimeMins: 130,
    corridorName: 'NH-48 Corridor -> Vadodara Central Transit Terminal',
  },
];
