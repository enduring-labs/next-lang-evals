import * as React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed 
        peer-disabled:opacity-70 ${className || ''}`}
        {...props}
      >
        {children}
      </label>
    );
  },
);

Label.displayName = 'Label';

export { Label };
