declare module 'opening_hours' {
  export default class OpeningHours {
    constructor(value: string, nominatim?: unknown, optional?: { locale?: string });
    getState(date?: Date): boolean;
    getNextChange(date?: Date): Date | undefined;
    getUnknown(date?: Date): boolean;
  }
}
