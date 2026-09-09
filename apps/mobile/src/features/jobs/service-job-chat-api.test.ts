import { describe, expect, it } from 'vitest';

import {
  mergeServiceJobMessage,
  validateServiceJobMessage,
  type ServiceJobMessage,
} from './service-job-chat-api';

const first: ServiceJobMessage = {
  id: '10000000-0000-0000-0000-000000000001',
  chat_room_id: '20000000-0000-0000-0000-000000000001',
  sender_user_id: '30000000-0000-0000-0000-000000000001',
  client_message_id: '40000000-0000-0000-0000-000000000001',
  body: 'ข้อความแรก',
  created_at: '2026-09-10T10:00:00.000Z',
};

describe('service job chat helpers', () => {
  it('trims a valid message and rejects empty or oversized messages', () => {
    expect(validateServiceJobMessage('  สวัสดีครับ  ')).toBe('สวัสดีครับ');
    expect(validateServiceJobMessage('   ')).toBeNull();
    expect(validateServiceJobMessage('ก'.repeat(2001))).toBeNull();
  });

  it('deduplicates realtime and RPC copies while preserving time order', () => {
    const later = {
      ...first,
      id: '10000000-0000-0000-0000-000000000002',
      client_message_id: '40000000-0000-0000-0000-000000000002',
      body: 'ข้อความถัดมา',
      created_at: '2026-09-10T10:01:00.000Z',
    };

    expect(mergeServiceJobMessage([later], first)).toEqual([first, later]);
    expect(mergeServiceJobMessage([first], { ...first })).toEqual([first]);
  });
});
