export type BookingState =
  | {
      error?: string;
      done?: { name: string; type: string; iso: string };
    }
  | undefined;

export type SettingsState = { error?: string; ok?: number } | undefined;
