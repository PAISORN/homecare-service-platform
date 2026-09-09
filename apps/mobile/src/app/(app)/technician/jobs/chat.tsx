import { ServiceJobChatScreen } from '../../../../features/jobs/service-job-chat-screen';

export default function TechnicianServiceJobChatRoute() {
  return (
    <ServiceJobChatScreen
      fallback="/technician/jobs/detail"
      mode="technician"
    />
  );
}
