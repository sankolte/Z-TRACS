// Event Bus Abstraction Contract (Model 3)
import { CanonicalEvent } from '../schemas/canonical';

export type EventTopic =
  | 'vms.events'
  | 'camera.events'
  | 'camera.health'
  | 'anpr.events'
  | 'vehicle.events'
  | 'alert.events'
  | 'correlation.events'
  | 'audit.events';

export interface EventBusAbstraction {
  publish(topic: EventTopic, event: CanonicalEvent): Promise<boolean>;
  subscribe(topic: EventTopic, handler: (event: CanonicalEvent) => Promise<void>): void;
  unsubscribe(topic: EventTopic): void;
}
