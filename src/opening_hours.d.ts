declare module 'opening_hours' {
  interface OpeningHoursIterator {
    setDate(date: Date): void;
    getDate(): Date;
    getState(): boolean;
    getUnknown(): boolean;
    /** Moves to the next state change; false when none occurs before `limit`. */
    advance(limit?: Date): boolean;
  }
  export default class OpeningHours {
    constructor(value: string, nominatim?: unknown, optional?: { locale?: string });
    getState(date?: Date): boolean;
    getUnknown(date?: Date): boolean;
    getNextChange(date?: Date, limit?: Date): Date | undefined;
    getWarnings(): string[];
    getIterator(date?: Date): OpeningHoursIterator;
  }
}
