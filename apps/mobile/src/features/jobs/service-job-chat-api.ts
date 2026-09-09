import type { RealtimeChannel } from '@supabase/supabase-js';

import type { MobileSupabaseClient } from '../../lib/supabase';

export const serviceJobMessageMaxLength = 2000;

export type ServiceJobMessage = Readonly<{
  id: string;
  chat_room_id: string;
  sender_user_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
}>;

export type ServiceJobChatRoom = Readonly<{
  id: string;
  service_job_id: string;
  topic: string;
}>;

export type ServiceJobChatConnectionState =
  'connecting' | 'live' | 'unavailable';

export function validateServiceJobMessage(body: string): string | null {
  const value = body.trim();
  return value.length >= 1 && value.length <= serviceJobMessageMaxLength
    ? value
    : null;
}

export function mergeServiceJobMessage(
  messages: readonly ServiceJobMessage[],
  incoming: ServiceJobMessage,
): readonly ServiceJobMessage[] {
  const withoutDuplicate = messages.filter(
    (message) => message.id !== incoming.id,
  );
  return [...withoutDuplicate, incoming].sort(compareMessages);
}

export async function getServiceJobChatRoom(
  client: MobileSupabaseClient,
  jobId: string,
): Promise<ServiceJobChatRoom> {
  const { data, error } = await client
    .from('chat_rooms')
    .select('id, service_job_id, topic')
    .eq('service_job_id', jobId)
    .single();
  if (error) throw error;
  return data as ServiceJobChatRoom;
}

export async function listServiceJobMessages(
  client: MobileSupabaseClient,
  chatRoomId: string,
): Promise<readonly ServiceJobMessage[]> {
  const { data, error } = await client
    .from('chat_messages')
    .select(
      'id, chat_room_id, sender_user_id, client_message_id, body, created_at',
    )
    .eq('chat_room_id', chatRoomId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as readonly ServiceJobMessage[]).slice().sort(compareMessages);
}

export async function sendServiceJobMessage(
  client: MobileSupabaseClient,
  jobId: string,
  clientMessageId: string,
  body: string,
): Promise<ServiceJobMessage> {
  const validBody = validateServiceJobMessage(body);
  if (!validBody) throw new Error('invalid_service_job_message');

  const { data, error } = await client.rpc('send_service_job_message', {
    p_job_id: jobId,
    p_client_message_id: clientMessageId,
    p_body: validBody,
  });
  if (error) throw error;
  return data as ServiceJobMessage;
}

export function subscribeToServiceJobMessages(
  client: MobileSupabaseClient,
  topic: string,
  onMessage: (message: ServiceJobMessage) => void,
  onStateChange: (state: ServiceJobChatConnectionState) => void,
): () => void {
  onStateChange('connecting');
  let channel: RealtimeChannel | null = client
    .channel(topic, { config: { private: true } })
    .on('broadcast', { event: 'message_created' }, (payload) =>
      onMessage(payload.payload as ServiceJobMessage),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onStateChange('live');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStateChange('unavailable');
      }
    });

  return () => {
    if (!channel) return;
    void client.removeChannel(channel);
    channel = null;
  };
}

function compareMessages(left: ServiceJobMessage, right: ServiceJobMessage) {
  const timestampOrder = left.created_at.localeCompare(right.created_at);
  return timestampOrder === 0
    ? left.id.localeCompare(right.id)
    : timestampOrder;
}
