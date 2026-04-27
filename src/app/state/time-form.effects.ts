import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { filter, map, mergeMap, of, tap } from 'rxjs';
import { TimeFormActions, TimeFormSnapshot } from './time-form.actions';

const STORAGE_KEY = 'time-input-poc.timeForm.snapshot.v1';

function isSnapshot(x: unknown): x is TimeFormSnapshot {
  if (!x || typeof x !== 'object') return false;
  const y = x as any;
  return (
    y.value &&
    typeof y.value === 'object' &&
    'time' in y.value
  );
}

@Injectable()
export class TimeFormEffects {
  persistToLocalStorage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(TimeFormActions.formChanged),
        tap(({ snapshot }) => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
          } catch {
            // ignore (quota / disabled storage)
          }
        }),
      ),
    { dispatch: false },
  );

  loadDraft$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TimeFormActions.loadDraft),
      mergeMap(() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return of(TimeFormActions.loadDraftEmpty());
          const parsed = JSON.parse(raw) as unknown;
          if (!isSnapshot(parsed)) return of(TimeFormActions.loadDraftEmpty());
          return of(TimeFormActions.loadDraftSuccess({ snapshot: parsed }));
        } catch {
          return of(TimeFormActions.loadDraftEmpty());
        }
      }),
    ),
  );

  constructor(private readonly actions$: Actions) {}
}

