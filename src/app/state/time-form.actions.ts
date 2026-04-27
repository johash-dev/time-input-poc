import { createActionGroup, emptyProps, props } from '@ngrx/store';

export type TimeFormValue = {
  time: string | null; // HH:mm or null
};

export type TimeFormSnapshot = {
  value: TimeFormValue;
  status: 'VALID' | 'INVALID' | 'DISABLED' | 'PENDING';
  dirty: boolean;
  touched: boolean;
  errors: unknown | null;
  controlErrors: Record<string, unknown> | null;
};

export const TimeFormActions = createActionGroup({
  source: 'TimeForm',
  events: {
    'Form Changed': props<{ snapshot: TimeFormSnapshot }>(),
    'Load Draft': emptyProps(),
    'Load Draft Success': props<{ snapshot: TimeFormSnapshot }>(),
    'Load Draft Empty': emptyProps(),
    'Reset Store': emptyProps(),
  },
});

