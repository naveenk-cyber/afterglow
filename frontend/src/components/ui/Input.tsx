import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      className = '',
      type = 'text',
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || `input-${generatedId}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const [showPassword, setShowPassword] = useState(false);

    const inputType = showPasswordToggle && type === 'password' && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-[0.8125rem] font-medium text-ink-muted"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle [&>svg]:h-4 [&>svg]:w-4">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={[
              'h-11 w-full rounded-control border bg-surface-muted text-sm text-ink',
              'placeholder:text-ink-subtle transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand/30',
              error
                ? 'border-error/60 focus:border-error'
                : 'border-line-strong hover:border-line-hover focus:border-brand',
              leftIcon ? 'pl-10' : 'pl-3.5',
              rightIcon || showPasswordToggle ? 'pr-10' : 'pr-3.5',
              'disabled:cursor-not-allowed disabled:opacity-55',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />

          {(rightIcon || (showPasswordToggle && type === 'password')) && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              {showPasswordToggle && type === 'password' ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-band-fill hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              ) : (
                <span className="pr-2 text-ink-subtle [&>svg]:h-4 [&>svg]:w-4">{rightIcon}</span>
              )}
            </span>
          )}
        </div>

        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            role={error ? 'alert' : undefined}
            className={`mt-1.5 text-xs ${error ? 'text-error-ink' : 'text-ink-subtle'}`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
