export type AccountRole = 'customer' | 'technician' | 'administrator';

export { isSupportedServiceCategory, serviceCategoryCodes } from './database';
export type { ServiceCategoryCode, ServiceCategoryRecord } from './database';

export type Money = Readonly<{
  amountMinor: number;
  currency: 'THB';
}>;

export type Coordinates = Readonly<{
  latitude: number;
  longitude: number;
}>;

export interface PaymentAdapter {
  createPayment(_input: {
    serviceJobId: string;
    amount: Money;
    idempotencyKey: string;
  }): Promise<{ paymentReference: string; status: 'pending' | 'authorized' }>;
}

export interface MapAdapter {
  geocode(_input: { address: string }): Promise<Coordinates | null>;
  estimateTravel(_input: {
    origin: Coordinates;
    destination: Coordinates;
  }): Promise<{ distanceMeters: number; durationSeconds: number }>;
}

export interface NotificationAdapter {
  send(_input: {
    recipientUserId: string;
    title: string;
    body: string;
    deepLink?: string;
  }): Promise<{ notificationId: string }>;
}
