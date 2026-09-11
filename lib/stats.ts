import { tripAmount } from '@/lib/format';
import type { Destination, EventRecord } from '@/lib/db/types';

export type PlaceStat = {
  destinationId: string;
  name: string;
  trips: number;
  carTrips: number;
  amount: number;
};

export type PeriodStats = {
  trainings: number;
  matches: number;
  attended: number;
  attendedTrainings: number;
  attendedMatches: number;
  trips: number;
  carTrips: number;
  amount: number;
  byPlace: PlaceStat[];
};

export function computeStats(events: EventRecord[], destinations: Destination[]): PeriodStats {
  const destMap = new Map(destinations.map((item) => [item.id, item]));
  const placeMap = new Map<string, PlaceStat>();

  let trainings = 0;
  let matches = 0;
  let attendedTrainings = 0;
  let attendedMatches = 0;
  let trips = 0;
  let carTrips = 0;
  let amount = 0;

  for (const event of events) {
    if (event.type === 'training') {
      trainings += 1;
      if (event.attended) attendedTrainings += 1;
    }
    if (event.type === 'match') {
      matches += 1;
      if (event.attended) attendedMatches += 1;
    }
    if (event.attended && event.traveled) {
      trips += 1;
      if (event.transport === 'car') carTrips += 1;

      const destination = event.destinationId ? destMap.get(event.destinationId) : undefined;
      const direction = event.tripDirection ?? 'round_trip';
      const tripPay = destination ? tripAmount(destination.roundTripRate, direction) : 0;
      amount += tripPay;

      const key = destination?.id ?? 'unknown';
      const existing = placeMap.get(key) ?? {
        destinationId: key,
        name: destination?.name ?? event.destinationName ?? 'Bez miejsca',
        trips: 0,
        carTrips: 0,
        amount: 0,
      };
      existing.trips += 1;
      if (event.transport === 'car') existing.carTrips += 1;
      existing.amount += tripPay;
      placeMap.set(key, existing);
    }
  }

  const byPlace = [...placeMap.values()].sort((a, b) => b.amount - a.amount || b.trips - a.trips);

  return {
    trainings,
    matches,
    attended: attendedTrainings + attendedMatches,
    attendedTrainings,
    attendedMatches,
    trips,
    carTrips,
    amount,
    byPlace,
  };
}
