import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TimeFormState } from './time-form.reducer';

export const selectTimeFormState = createFeatureSelector<TimeFormState>('timeForm');

export const selectTimeFormSnapshot = createSelector(
  selectTimeFormState,
  (s) => s.snapshot,
);

export const selectHydrationId = createSelector(
  selectTimeFormState,
  (s) => s.hydrationId,
);

