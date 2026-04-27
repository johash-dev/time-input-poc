import {
  Component,
  ElementRef,
  HostListener,
  Input,
  Output,
  ViewChild,
  forwardRef,
  EventEmitter,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

@Component({
  selector: 'app-time-input',
  templateUrl: './time-input.component.html',
  styleUrls: ['./time-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimeInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => TimeInputComponent),
      multi: true,
    },
  ],
})
export class TimeInputComponent implements ControlValueAccessor, Validator {
  @Input() label?: string;
  @Input() placeholder?: string;
  /**
   * Width behavior:
   * - 'fixed' keeps the original 170px max-width (looks like the reference screenshot)
   * - 'fluid' stretches to the parent container width
   */
  @Input() widthConstraint: 'fixed' | 'fluid' = 'fixed';
  // Compatibility inputs (mirrors `ui-timepicker2`)
  @Input() required = false;
  @Input() showRedAsterisk = true;
  @Input() showAddOn = true; // no-op in this POC; kept for plug-and-play

  @Input() requiredAsterisk = false;

  @Input() minuteStep = 30;
  @Input() set nzMinuteStep(value: number) {
    const v = Number(value);
    if (Number.isFinite(v) && v > 0) this.minuteStep = v;
  }

  @Input() minHour = 0; // 24h
  @Input() minMinute = 0;
  @Input() errorMessage?: string;
  @Input() showCancel = true;
  @Input() set disabled(value: boolean) {
    this.inputDisabled = !!value;
    this.recomputeDisabled();
  }

  @ViewChild('textInput', { static: true }) textInput!: ElementRef<HTMLInputElement>;

  // Support existing `(ngModelChange)="..."` bindings in consumers.
  @Output() ngModelChange = new EventEmitter<string | null>();

  isDisabled = false;
  isPickerOpen = false;

  displayValue = ''; // 12h text shown in input
  private lastValidHHmm: string | null = null; // emitted to form
  internalError: string | null = null; // ui-only; does not emit invalid to form

  // Picker selection state (12h)
  pickerHour12: number = 12;
  pickerMinute: number = 0;
  pickerMeridian: 'AM' | 'PM' = 'AM';

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  private cvaDisabled = false;
  private inputDisabled = false;

  constructor() {}

  get isFluidWidth(): boolean {
    return this.widthConstraint === 'fluid';
  }

  pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  // ---- ControlValueAccessor ----
  writeValue(value: string | null): void {
    this.lastValidHHmm = value ?? null;
    this.displayValue = value ? this.to12hDisplay(value) : '';
    this.internalError = null;
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled = isDisabled;
    this.recomputeDisabled();
  }

  private recomputeDisabled(): void {
    this.isDisabled = this.cvaDisabled || this.inputDisabled;
    if (this.isDisabled) this.isPickerOpen = false;
  }

  // ---- Validator ----
  validate(control: AbstractControl): ValidationErrors | null {
    // Validates committed form value (HH:mm). Typed-but-uncommitted errors are shown via internalError only.
    const value = control.value as string | null;
    if (value == null || value === '') {
      if (this.required) return { required: true };
      return null;
    }

    const parsed = this.parseHHmm(value);
    if (!parsed.ok) return { time: { reason: 'format' } };

    const minutes = parsed.minutes;
    const min = this.minHour * 60 + this.minMinute;

    if (minutes < min) return { time: { reason: 'minTime', min: this.formatHHmm(min) } };
    if (minutes % this.minuteStep !== 0) return { time: { reason: 'minuteStep', step: this.minuteStep } };

    return null;
  }

  // ---- UI handlers ----
  onInputBlur(): void {
    this.commit();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit();
    }
    if (event.key === 'Escape') {
      this.isPickerOpen = false;
      this.revertToLastValid();
    }
  }

  togglePicker(): void {
    if (this.isDisabled) return;
    this.isPickerOpen = !this.isPickerOpen;
    if (this.isPickerOpen) this.syncPickerFromCurrent();
  }

  onSelectTime(hhmm: string): void {
    if (this.isDisabled) return;
    this.internalError = null;
    this.lastValidHHmm = hhmm;
    this.displayValue = this.to12hDisplay(hhmm);
    this.onTouched();
    this.onChange(hhmm);
    this.ngModelChange.emit(hhmm);
  }

  onCancelPicker(): void {
    this.isPickerOpen = false;
    this.revertToLastValid();
  }

  // ---- Picker options (reference-like 3 columns) ----
  get pickerHours(): number[] {
    return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  }

  get pickerMinutes(): number[] {
    const step = Math.max(1, Math.floor(this.minuteStep || 1));
    const minutes: number[] = [];
    for (let m = 0; m < 60; m += step) minutes.push(m);
    return minutes;
  }

  get pickerMeridians(): Array<'AM' | 'PM'> {
    return ['AM', 'PM'];
  }

  selectPickerHour(hour12: number): void {
    this.pickerHour12 = hour12;
    this.tryCommitPickerSelection();
  }

  selectPickerMinute(minute: number): void {
    this.pickerMinute = minute;
    this.tryCommitPickerSelection();
  }

  selectPickerMeridian(meridian: 'AM' | 'PM'): void {
    this.pickerMeridian = meridian;
    this.tryCommitPickerSelection();
  }

  isPickerOptionValid(hour12: number, minute: number, meridian: 'AM' | 'PM'): boolean {
    const minutes = this.toMinutesSinceMidnight(hour12, minute, meridian);
    const min = this.minHour * 60 + this.minMinute;
    const step = Math.max(1, Math.floor(this.minuteStep || 1));
    if (minutes < min) return false;
    if (minutes % step !== 0) return false;
    return true;
  }

  isPickerHourDisabled(hour12: number): boolean {
    // disabled if no minute/meridian combination is valid for this hour
    for (const minute of this.pickerMinutes) {
      for (const mer of this.pickerMeridians) {
        if (this.isPickerOptionValid(hour12, minute, mer)) return false;
      }
    }
    return true;
  }

  isPickerMinuteDisabled(minute: number): boolean {
    for (const mer of this.pickerMeridians) {
      if (this.isPickerOptionValid(this.pickerHour12, minute, mer)) return false;
    }
    return true;
  }

  isPickerMeridianDisabled(meridian: 'AM' | 'PM'): boolean {
    return !this.isPickerOptionValid(this.pickerHour12, this.pickerMinute, meridian);
  }

  get effectiveErrorMessage(): string | null {
    if (this.errorMessage) return this.errorMessage;

    if (!this.internalError) return null;
    switch (this.internalError) {
      case 'format':
        return 'Invalid time format. Use h:mm AM/PM';
      case 'minuteStep':
        return `Time must be in ${this.minuteStep}-minute increments`;
      case 'minTime':
        // In session-availability, end minTime is derived as the *next* slot after start.
        // Showing the previous slot time reads clearer to users (e.g. start 10:30 → message "after 10:30",
        // while the actual minimum selectable value is 11:00 due to step constraints).
        return `Time must be after ${this.getMinTimeErrorDisplay()}`;
      default:
        return 'Invalid time';
    }
  }

  private getMinTimeErrorDisplay(): string {
    const minTotal = this.minHour * 60 + this.minMinute;
    const step = Math.max(1, Math.floor(this.minuteStep || 1));

    const base = minTotal >= step ? minTotal - step : minTotal;
    return this.to12hDisplay(this.formatHHmm(base));
  }

  // Close picker on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isPickerOpen) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Close only when clicking outside this component.
    const inside = !!target.closest('.time-input-root');
    if (!inside) this.isPickerOpen = false;
  }

  private commit(): void {
    this.onTouched();

    const raw = (this.displayValue ?? '').trim();
    if (raw === '') {
      this.internalError = null;
      this.lastValidHHmm = null;
      this.onChange(null);
      this.ngModelChange.emit(null);
      return;
    }

    const parsed = this.parseUserTime(raw);
    if (!parsed.ok) {
      this.internalError = 'format';
      return;
    }

    const minutes = parsed.minutes;
    const min = this.minHour * 60 + this.minMinute;

    if (minutes < min) {
      this.internalError = 'minTime';
      return;
    }
    if (minutes % this.minuteStep !== 0) {
      this.internalError = 'minuteStep';
      return;
    }

    const hhmm = this.formatHHmm(minutes);
    this.internalError = null;
    this.lastValidHHmm = hhmm;
    this.displayValue = this.to12hDisplay(hhmm);
    this.onChange(hhmm);
    this.ngModelChange.emit(hhmm);
  }

  private revertToLastValid(): void {
    this.internalError = null;
    this.displayValue = this.lastValidHHmm ? this.to12hDisplay(this.lastValidHHmm) : '';
  }

  private syncPickerFromCurrent(): void {
    const candidate = this.lastValidHHmm ?? null;
    const min = this.minHour * 60 + this.minMinute;
    const step = Math.max(1, Math.floor(this.minuteStep || 1));

    // If min is beyond the last minute of the day, there are no valid options.
    if (min >= 24 * 60) {
      this.pickerHour12 = 12;
      this.pickerMinute = 0;
      this.pickerMeridian = 'AM';
      return;
    }

    let minutes: number;
    if (candidate) {
      const parsed = this.parseHHmm(candidate);
      minutes = parsed.ok ? parsed.minutes : min;
    } else {
      // choose the earliest valid time >= min, rounded up to step
      minutes = min;
      if (minutes % step !== 0) minutes = minutes + (step - (minutes % step));
    }

    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    this.pickerMeridian = hh >= 12 ? 'PM' : 'AM';
    this.pickerHour12 = ((hh + 11) % 12) + 1;
    if (this.pickerHour12 === 12) {
      // keep 12 first in list; already.
    }
    this.pickerMinute = mm - (mm % step);
    // if rounding down made it invalid (<min), bump to next minute option
    if (!this.isPickerOptionValid(this.pickerHour12, this.pickerMinute, this.pickerMeridian)) {
      this.tryCommitPickerSelection();
    }
  }

  private tryCommitPickerSelection(): void {
    // Keep immediate commit behavior, but avoid emitting invalid.
    if (this.isDisabled) return;

    // If current combination invalid (e.g. minTime), try to auto-fix minute by choosing the first valid minute.
    const step = Math.max(1, Math.floor(this.minuteStep || 1));
    const minMinutes = this.minHour * 60 + this.minMinute;

    if (!this.isPickerOptionValid(this.pickerHour12, this.pickerMinute, this.pickerMeridian)) {
      // attempt to find nearest valid minute for current hour/meridian
      const validMinute = this.pickerMinutes.find((m) =>
        this.isPickerOptionValid(this.pickerHour12, m, this.pickerMeridian),
      );
      if (validMinute != null) this.pickerMinute = validMinute;
    }

    const minutes = this.toMinutesSinceMidnight(this.pickerHour12, this.pickerMinute, this.pickerMeridian);
    if (minutes < minMinutes) return;
    if (minutes % step !== 0) return;

    this.onSelectTime(this.formatHHmm(minutes));
  }

  private toMinutesSinceMidnight(hour12: number, minute: number, meridian: 'AM' | 'PM'): number {
    const h12 = ((hour12 - 1) % 12) + 1;
    let hour24 = h12 % 12;
    if (meridian === 'PM') hour24 += 12;
    return hour24 * 60 + minute;
  }

  private parseUserTime(input: string): { ok: true; minutes: number } | { ok: false } {
    const trimmed = input.trim();

    // Accept dot-separated time too (e.g. "2.30", "10.00", "2.30 PM").
    // Convert a single dot separator to colon for reuse of existing parsing.
    const dotNormalized = trimmed.replace(/^(\d{1,2})\s*\.\s*(\d{2})(.*)$/, '$1:$2$3');

    // Accept HH:mm (24h) as well for paste convenience.
    const hhmm = this.parseHHmm(dotNormalized);
    if (hhmm.ok) return hhmm;

    const normalized = dotNormalized.replace(/\s+/g, ' ').trim();

    // e.g. "1:30 PM", "1:30PM", "1:30 p", "1:30 pm"
    const m = normalized.match(/^(\d{1,2})\s*:\s*(\d{2})\s*([aApP])\s*([mM])?$/);
    if (!m) return { ok: false };

    const hour12 = Number(m[1]);
    const minute = Number(m[2]);
    const ap = m[3].toUpperCase();

    if (!Number.isFinite(hour12) || hour12 < 1 || hour12 > 12) return { ok: false };
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) return { ok: false };

    let hour24 = hour12 % 12;
    if (ap === 'P') hour24 += 12;

    return { ok: true, minutes: hour24 * 60 + minute };
  }

  private parseHHmm(input: string): { ok: true; minutes: number } | { ok: false } {
    const m = input.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return { ok: false };
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || hh < 0 || hh > 23) return { ok: false };
    if (!Number.isFinite(mm) || mm < 0 || mm > 59) return { ok: false };
    return { ok: true, minutes: hh * 60 + mm };
  }

  private formatHHmm(minutesSinceMidnight: number): string {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutesSinceMidnight)));
    const hh = Math.floor(clamped / 60);
    const mm = clamped % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  private to12hDisplay(hhmm: string): string {
    const parsed = this.parseHHmm(hhmm);
    if (!parsed.ok) return hhmm;
    const hh = Math.floor(parsed.minutes / 60);
    const mm = parsed.minutes % 60;
    const ap = hh >= 12 ? 'PM' : 'AM';
    const hour12 = ((hh + 11) % 12) + 1;
    return `${hour12}:${String(mm).padStart(2, '0')} ${ap}`;
  }
}
