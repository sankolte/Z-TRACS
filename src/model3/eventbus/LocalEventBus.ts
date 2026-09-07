// Local Event Bus Engine (Model 3)
import { EventBusAbstraction, EventTopic } from './EventBusAbstraction';
import { CanonicalEvent } from '../schemas/canonical';
import { RetryEngine } from './RetryEngine';

export class LocalEventBus implements EventBusAbstraction {
  private static instance: LocalEventBus;
  private subscribers: Map<EventTopic, Array<(event: CanonicalEvent) => Promise<void>>> = new Map();
  private eventHistory: CanonicalEvent[] = [];

  private constructor() {}

  static getInstance(): LocalEventBus {
    if (!LocalEventBus.instance) {
      LocalEventBus.instance = new LocalEventBus();
    }
    return LocalEventBus.instance;
  }

  async publish(topic: EventTopic, event: CanonicalEvent): Promise<boolean> {
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 50) this.eventHistory.pop();

    const handlers = this.subscribers.get(topic) || [];
    const retryEngine = RetryEngine.getInstance();

    for (const handler of handlers) {
      try {
        await retryEngine.executeWithRetry(() => handler(event), 3, 50);
      } catch (err: any) {
        retryEngine.pushToDlq(
          event.eventId,
          event.source.vmsId,
          event.source.connectorId,
          err?.message || 'Consumer processing failure',
          event.rawPayload || {}
        );
      }
    }
    return true;
  }

  subscribe(topic: EventTopic, handler: (event: CanonicalEvent) => Promise<void>): void {
    const list = this.subscribers.get(topic) || [];
    list.push(handler);
    this.subscribers.set(topic, list);
  }

  unsubscribe(topic: EventTopic): void {
    this.subscribers.delete(topic);
  }

  getEventHistory(): CanonicalEvent[] {
    return this.eventHistory;
  }
}
