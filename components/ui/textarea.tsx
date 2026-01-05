import { cn } from '@/lib/utils/utils';
import * as React from 'react';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autogrow?: boolean; // Add autogrow prop
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autogrow = true, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Merge forwarded ref with internal ref
    const mergedRef = React.useCallback(
      (node: HTMLTextAreaElement) => {
        if (ref) {
          if (typeof ref === 'function') ref(node);
          else ref.current = node;
        }
        textareaRef.current = node;
      },
      [ref],
    );

    // Handle auto-grow logic
    const handleInput = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea && autogrow) {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
      }
    }, [autogrow]);

    // Attach auto-grow on mount and input events
    React.useEffect(() => {
      if (autogrow) {
        handleInput(); // Adjust on initial render
      }
    }, [autogrow, handleInput]);

    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={mergedRef}
        onInput={(e) => {
          if (autogrow) handleInput();
          if (props.onInput) props.onInput(e); // Preserve other input handlers
        }}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea };
