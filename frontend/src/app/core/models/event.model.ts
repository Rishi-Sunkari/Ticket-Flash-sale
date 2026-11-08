export interface EventSummary {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  currency: string;
  capacity: number;
  reservedTickets: number;
  availableTickets: number;
  priceCents: number;
  isSoldOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventPayload {
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  capacity: number;
  priceCents: number;
  currency: string;
}
