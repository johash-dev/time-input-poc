import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { distinctUntilChanged, firstValueFrom, Subject, takeUntil, take } from 'rxjs';
import { TimeFormActions, TimeFormSnapshot } from './state/time-form.actions';
import { selectHydrationId, selectTimeFormSnapshot } from './state/time-form.selectors';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'time-input-poc';

  isSpecOpen = false;

  readonly form: FormGroup<{
    time: FormControl<string | null>;
  }>;

  readonly configForm: FormGroup<{
    label: FormControl<string>;
    placeholder: FormControl<string>;
    widthConstraint: FormControl<'fixed' | 'fluid'>;
    minuteStep: FormControl<number>;
    minHour: FormControl<number>;
    minMinute: FormControl<number>;
    requiredAsterisk: FormControl<boolean>;
    disabled: FormControl<boolean>;
    showCancel: FormControl<boolean>;
    externalErrorEnabled: FormControl<boolean>;
    externalErrorText: FormControl<string>;
    tiBorder: FormControl<string>;
    tiFocus: FormControl<string>;
    tiMuted: FormControl<string>;
    tiOk: FormControl<string>;
  }>;

  readonly valueChangesLog: Array<{ at: string; value: string | null }> = [];
  readonly snapshot$ = this.store.select(selectTimeFormSnapshot);

  // Start/End simulation (mirrors session-availability min end-time behavior)
  readonly simulationForm: FormGroup<{
    startTime: FormControl<string | null>;
    endTime: FormControl<string | null>;
  }>;

  simMinEndHour = 0;
  simMinEndMinute = 0;

  // Responsiveness test
  readonly responsivenessForm: FormGroup<{
    narrow: FormControl<string | null>;
    medium: FormControl<string | null>;
    wide: FormControl<string | null>;
    fluid: FormControl<string | null>;
  }>;

  private readonly destroy$ = new Subject<void>();
  private lastHydrationId = 0;

  constructor(
    fb: FormBuilder,
    private readonly store: Store,
  ) {
    this.form = fb.group({
      time: fb.control<string | null>(null, { validators: [Validators.required] }),
    });

    this.configForm = fb.group({
      label: fb.nonNullable.control('Start'),
      placeholder: fb.nonNullable.control('Select'),
      widthConstraint: fb.nonNullable.control<'fixed' | 'fluid'>('fixed'),
      minuteStep: fb.nonNullable.control(30),
      minHour: fb.nonNullable.control(13),
      minMinute: fb.nonNullable.control(0),
      requiredAsterisk: fb.nonNullable.control(true),
      disabled: fb.nonNullable.control(false),
      showCancel: fb.nonNullable.control(true),
      externalErrorEnabled: fb.nonNullable.control(false),
      externalErrorText: fb.nonNullable.control('External errorMessage injected from parent'),
      tiBorder: fb.nonNullable.control('#dfe3e8'),
      tiFocus: fb.nonNullable.control('#79b68c'),
      tiMuted: fb.nonNullable.control('#8a97a3'),
      tiOk: fb.nonNullable.control('#d81b7d'),
    });

    this.simulationForm = fb.group({
      startTime: fb.control<string | null>(null),
      endTime: fb.control<string | null>(null),
    });

    this.responsivenessForm = fb.group({
      narrow: fb.control<string | null>(null),
      medium: fb.control<string | null>(null),
      wide: fb.control<string | null>(null),
      fluid: fb.control<string | null>(null),
    });
  }

  ngOnInit(): void {
    // Dispatch snapshot changes to store (reactive forms -> NgRx)
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      const now = new Date().toLocaleTimeString();
      this.valueChangesLog.unshift({ at: now, value: value.time ?? null });
      if (this.valueChangesLog.length > 10) this.valueChangesLog.length = 10;
      this.store.dispatch(TimeFormActions.formChanged({ snapshot: this.buildSnapshot() }));
    });

    this.form.statusChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.store.dispatch(TimeFormActions.formChanged({ snapshot: this.buildSnapshot() }));
    });

    // Rehydrate from store only when load-draft completes (avoids feedback loops)
    this.store
      .select(selectHydrationId)
      .pipe(takeUntil(this.destroy$), distinctUntilChanged())
      .subscribe((hydrationId) => {
        if (hydrationId === this.lastHydrationId) return;
        this.lastHydrationId = hydrationId;
        this.rehydrateFromStoreOnce();
      });

    // Simulation: whenever start time changes, recompute min end-time and clear endTime
    this.simulationForm.controls.startTime.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((start) => this.onSimulationStartChange(start));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openSpec(): void {
    this.isSpecOpen = true;
  }

  closeSpec(): void {
    this.isSpecOpen = false;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isSpecOpen) return;
    if (event.key === 'Escape') this.closeSpec();
  }

  onLoadDraft(): void {
    this.store.dispatch(TimeFormActions.loadDraft());
  }

  onResetStore(): void {
    this.store.dispatch(TimeFormActions.resetStore());
    // also reset the form UI to match
    this.form.reset({ time: null }, { emitEvent: false });
    this.valueChangesLog.length = 0;
  }

  get externalErrorMessage(): string | undefined {
    const enabled = this.configForm.controls.externalErrorEnabled.value;
    const text = this.configForm.controls.externalErrorText.value;
    return enabled ? text : undefined;
  }

  get timeInputThemeStyle(): Record<string, string> {
    return {
      '--ti-border': this.configForm.controls.tiBorder.value,
      '--ti-focus': this.configForm.controls.tiFocus.value,
      '--ti-muted': this.configForm.controls.tiMuted.value,
      '--ti-ok': this.configForm.controls.tiOk.value,
    };
  }

  onSimulationStartChange(startHHmm: string | null): void {
    if (!startHHmm) {
      this.simMinEndHour = 0;
      this.simMinEndMinute = 0;
      this.simulationForm.controls.endTime.setValue(null, { emitEvent: false });
      return;
    }

    const parts = startHHmm.split(':');
    if (parts.length !== 2) return;

    let selectedHour = parseInt(parts[0], 10);
    let selectedMinute = parseInt(parts[1], 10);
    if (!Number.isFinite(selectedHour) || !Number.isFinite(selectedMinute)) return;

    // Session-availability rule: next slot after start (assumes 30-min increments)
    if (selectedMinute === 30) {
      selectedHour = selectedHour + 1;
      selectedMinute = 0;
    } else if (selectedMinute === 0) {
      selectedMinute = 30;
    }

    // If start is the last slot (e.g. 23:30), this will produce 24:00.
    // We intentionally allow `minHour=24` to represent "no valid end times left today".
    this.simMinEndHour = selectedHour;
    this.simMinEndMinute = selectedMinute;

    this.simulationForm.controls.endTime.setValue(null, { emitEvent: false });
  }

  private async rehydrateFromStoreOnce(): Promise<void> {
    const snapshot = await firstValueFrom(
      this.store.select(selectTimeFormSnapshot).pipe(take(1)),
    );

    this.form.patchValue(snapshot.value, { emitEvent: false });

    // approximate touched/dirty state
    const timeCtrl = this.form.controls.time;
    if (snapshot.dirty) timeCtrl.markAsDirty();
    if (snapshot.touched) timeCtrl.markAsTouched();
  }

  private buildSnapshot(): TimeFormSnapshot {
    const timeCtrl = this.form.controls.time;

    return {
      value: { time: timeCtrl.value ?? null },
      status: this.form.status,
      dirty: this.form.dirty,
      touched: this.form.touched,
      errors: this.form.errors ?? null,
      controlErrors: timeCtrl.errors ?? null,
    };
  }
}
