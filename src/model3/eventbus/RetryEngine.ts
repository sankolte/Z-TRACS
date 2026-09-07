// Retry Engine & Dead Letter Queue (DLQ) (Model 3)
import { DlqEventRecord, CanonicalEvent } from '../schemas/canonical';

export class RetryEngine {
  private static instance: RetryEngine;
  private dlqRecords: DlqEventRecord[] = [
    {
      dlqId: 'dlq-1001',
      eventId: 'evt-failed-9912',
      failedTimestamp: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      retryCount: 3,
      lastErrorReason: 'HTTP 504 Gateway Timeout during enrichment webhook query',
      sourceVmsId: 'VMS-GEN-02',
      connectorId: 'conn-genetec-rest-v2',
      rawPayload: { plate: 'GJ01AB1234', rawTime: '10:12:00' },
      status: 'FAILED',
    },
    {
      dlqId: 'dlq-1002',
      eventId: 'evt-failed-9914',
      failedTimestamp: new Date(Date.now() - 1800000).toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      retryCount: 3,
      lastErrorReason: 'Malformed Schema Field: location.latitude (received string instead of number)',
      sourceVmsId: 'VMS-MIL-01',
      connectorId: 'conn-onvif-v1',
      rawPayload: { plate: 'GJ05CD7788', rawTime: '10:45:00' },
      status: 'FAILED',
    },
  ];

  private constructor() {}

  static getInstance(): RetryEngine {
    if (!RetryEngine.instance) {
      RetryEngine.instance = new RetryEngine();
    }
    return RetryEngine.instance;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 100
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  pushToDlq(eventId: string, sourceVmsId: string, connectorId: string, errorReason: string, rawPayload: Record<string, any>): DlqEventRecord {
    const record: DlqEventRecord = {
      dlqId: `dlq-${Date.now()}`,
      eventId,
      failedTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' IST',
      retryCount: 3,
      lastErrorReason: errorReason,
      sourceVmsId,
      connectorId,
      rawPayload,
      status: 'FAILED',
    };
    this.dlqRecords.unshift(record);
    return record;
  }

  getDlqRecords(): DlqEventRecord[] {
    return this.dlqRecords;
  }

  replayDlqRecord(dlqId: string): boolean {
    const rec = this.dlqRecords.find(r => r.dlqId === dlqId);
    if (rec) {
      rec.status = 'REPLAYED';
      return true;
    }
    return false;
  }
}
