'use client';

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// Chrome ignores autocomplete="off" for saved addresses; an unrecognised token suppresses its suggestions.
const NO_AUTOFILL = 'f2f-no-autofill';

const FILL = {
  autoCorrect: 'off',
  autoCapitalize: 'none',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const;

type NoFillInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** When false, the field accepts typing on first focus (use for product search). Default true reduces autofill on address fields. */
  lockUntilInteraction?: boolean;
};

export function NoFillInput({
  onFocus,
  onBlur,
  onMouseDown,
  lockUntilInteraction = true,
  ...props
}: NoFillInputProps) {
  const [locked, setLocked] = useState(lockUntilInteraction);
  return (
    <input
      {...FILL}
      {...props}
      autoComplete={NO_AUTOFILL}
      readOnly={locked}
      onMouseDown={(event) => {
        setLocked(false);
        onMouseDown?.(event);
      }}
      onFocus={(event) => {
        setLocked(false);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setLocked(true);
        onBlur?.(event);
      }}
    />
  );
}

export function NoFillTextarea({
  onFocus,
  onBlur,
  onMouseDown,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [locked, setLocked] = useState(true);
  return (
    <textarea
      {...FILL}
      {...props}
      autoComplete={NO_AUTOFILL}
      readOnly={locked}
      onMouseDown={(event) => {
        setLocked(false);
        onMouseDown?.(event);
      }}
      onFocus={(event) => {
        setLocked(false);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setLocked(true);
        onBlur?.(event);
      }}
    />
  );
}

export function BrowserAddressDecoy() {
  return (
    <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
      <input type="text" tabIndex={-1} name="name" autoComplete="name" defaultValue="" />
      <input type="text" tabIndex={-1} name="address-line1" autoComplete="address-line1" defaultValue="" />
      <input type="text" tabIndex={-1} name="address-line2" autoComplete="address-line2" defaultValue="" />
      <input type="text" tabIndex={-1} name="city" autoComplete="address-level2" defaultValue="" />
      <input type="text" tabIndex={-1} name="postal-code" autoComplete="postal-code" defaultValue="" />
      <input type="tel" tabIndex={-1} name="tel" autoComplete="tel" defaultValue="" />
    </div>
  );
}
