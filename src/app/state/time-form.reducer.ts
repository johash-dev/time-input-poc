import { createReducer, on } from '@ngrx/store';
import { TimeFormActions, TimeFormSnapshot } from './time-form.actions';

export type TimeFormState = {
  snapshot: TimeFormSnapshot;
  hydrationId: number;
};

export const initialSnapshot: TimeFormSnapshot = {
  value: { time: null },
  status: 'VALID',
  dirty: false,
  touched: false,
  errors: null,
  controlErrors: null,
};

export const initialState: TimeFormState = {
  snapshot: initialSnapshot,
  hydrationId: 0,
};

export const timeFormReducer = createReducer(
  initialState,
  on(TimeFormActions.formChanged, (state, { snapshot }) => ({
    ...state,
    snapshot,
  })),
  on(TimeFormActions.loadDraftSuccess, (state, { snapshot }) => ({
    ...state,
    snapshot,
    hydrationId: state.hydrationId + 1,
  })),
  on(TimeFormActions.loadDraftEmpty, (state) => ({
    ...state,
    hydrationId: state.hydrationId + 1,
  })),
  on(TimeFormActions.resetStore, () => initialState),
);

