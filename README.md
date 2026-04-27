# time-input-poc

Angular **15.2.3** POC demonstrating a custom `TimeInputComponent` with:
- Reactive forms (`ControlValueAccessor` + `Validator`)
- Manual typing **and** picker selection
- `minuteStep` (30-minute increments)
- `minTime` (`minHour`/`minMinute`)
- 12h display in the UI, emits 24h `HH:mm` string to the form
- **Never emits invalid values** (so reactive form + NgRx state won’t update on invalid input)
- Classic **NgRx Store/Effects** integration that stores a form snapshot and rehydrates from `localStorage`

## Run
From the project folder:

```bash
npm install
npm start
```

If port `4200` is already taken, run:

```bash
npm start -- --port 4201
```

Open `http://localhost:4201/` (or the port you chose).

## What to verify in the UI
- **Valid commit**: type `1:30 PM` and blur/press Enter → form value becomes `"13:30"` and NgRx snapshot updates.
- **Invalid step**: type `1:10 PM` and blur → error shown, but **form value + `valueChanges` log do not change**.
- **Min time**: `minTime` in demo is `13:00`; selecting/typing earlier values won’t commit.
- **NgRx rehydrate**: click **Load draft** to pull the saved snapshot from `localStorage` into the store and patch the form **without dispatch loops**.

## Tests

```bash
npm test -- --watch=false
```
