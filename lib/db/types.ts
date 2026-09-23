export type EventType = 'training' | 'match';
export type Transport = 'car' | 'other';
export type DistanceType = 'one_way' | 'round_trip';
export type TripDirection = 'round_trip' | 'outbound' | 'return';

export type Season = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Destination = {
  id: string;
  name: string;
  address: string | null;
  distance: number;
  distanceType: DistanceType;
  roundTripRate: number;
  createdAt: string;
  updatedAt: string;
};

export type EventRecord = {
  id: string;
  seasonId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  type: EventType;
  destinationId: string | null;
  attended: boolean | null;
  traveled: boolean | null;
  transport: Transport | null;
  arrived: boolean | null;
  tripDirection: TripDirection | null;
  notes: string | null;
  absenceNote: string | null;
  completed: boolean;
  notificationId: string | null;
  source: 'manual' | 'schedule';
  scheduleRuleId: string | null;
  createdAt: string;
  updatedAt: string;
  destinationName: string | null;
};

export type ScheduleRule = {
  id: string;
  type: EventType;
  weekdays: number[];
  startTime: string;
  endTime: string | null;
  destinationId: string | null;
  notes: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  reminderEnabled: boolean;
  reminderTime: string;
  reminderOffsetMinutes: number;
  kilometerRate: number;
  defaultDurationMinutes: number;
  telegramBotToken: string;
  telegramChatId: string;
  telegramBlobId: string;
};

export type EventDraft = {
  seasonId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  type: EventType;
  destinationId: string | null;
  notes: string | null;
  source?: 'manual' | 'schedule';
  scheduleRuleId?: string | null;
};

export type CompletionDraft = {
  attended: boolean;
  absenceNote: string | null;
  traveled: boolean | null;
  transport: Transport | null;
  destinationId: string | null;
  tripDirection: TripDirection | null;
  notes: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  reminderEnabled: true,
  reminderTime: '20:00',
  reminderOffsetMinutes: 0,
  kilometerRate: 1,
  defaultDurationMinutes: 90,
  telegramBotToken: '',
  telegramChatId: '',
  telegramBlobId: '',
};
