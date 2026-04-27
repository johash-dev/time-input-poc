import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeInputComponent } from './time-input.component';

describe('TimeInputComponent', () => {
  let component: TimeInputComponent;
  let fixture: ComponentFixture<TimeInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TimeInputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimeInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('commits valid 12h input and emits HH:mm', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);
    component.minuteStep = 30;
    component.minHour = 0;
    component.minMinute = 0;

    component.displayValue = '1:30 PM';
    (component as any).commit();

    expect(onChange).toHaveBeenCalledWith('13:30');
  });

  it('accepts dot-separated input (e.g. 2.30) and normalizes', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);
    component.minuteStep = 30;
    component.minHour = 0;
    component.minMinute = 0;

    component.displayValue = '2.30';
    (component as any).commit();

    expect(onChange).toHaveBeenCalledWith('02:30');
  });

  it('does not emit on invalid step', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);
    component.minuteStep = 30;

    component.displayValue = '1:10 PM';
    (component as any).commit();

    expect(onChange).not.toHaveBeenCalled();
    expect(component.internalError).toBe('minuteStep');
  });

  it('does not emit on invalid minTime', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);
    component.minuteStep = 30;
    component.minHour = 13;
    component.minMinute = 0;

    component.displayValue = '12:30 PM';
    (component as any).commit();

    expect(onChange).not.toHaveBeenCalled();
    expect(component.internalError).toBe('minTime');
  });

  it('clearing emits null', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);

    component.displayValue = '';
    (component as any).commit();

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('picker selection recomposes to HH:mm and emits immediately', () => {
    const onChange = jasmine.createSpy('onChange');
    component.registerOnChange(onChange);

    component.minuteStep = 30;
    component.minHour = 0;
    component.minMinute = 0;

    component.selectPickerHour(1);
    component.selectPickerMinute(30);
    component.selectPickerMeridian('PM');

    expect(onChange).toHaveBeenCalledWith('13:30');
  });
});
