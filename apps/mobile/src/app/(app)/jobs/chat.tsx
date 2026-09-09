import { ServiceJobChatScreen } from '../../../features/jobs/service-job-chat-screen';

export default function CustomerServiceJobChatRoute() {
  return <ServiceJobChatScreen fallback="/jobs/detail" mode="customer" />;
}
