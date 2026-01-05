import * as React from 'react';

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        ref={ref}
        onClick={() => onCheckedChange(!checked)}
        className={`
          relative inline-flex shrink-0 h-6 w-11 cursor-pointer items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        {...props}
      >
        <span
          data-state={checked ? 'checked' : 'unchecked'}
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white
            shadow transform ring-0 transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </button>
    );
  },
);

Switch.displayName = 'Switch';

export { Switch };
