import React from 'react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
  className?: string;
}

export function ProgressIndicator({
  currentStep,
  totalSteps,
  stepLabel,
  className = '',
}: ProgressIndicatorProps) {
  return (
    <div className={`text-center ${className}`}>
      <div className="flex items-center justify-center gap-2 mb-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber <= currentStep;
          const isActive = stepNumber === currentStep;

          return (
            <React.Fragment key={stepNumber}>
              <div
                className={`w-3 h-3 rounded-full ${
                  isCompleted ? 'bg-primary' : 'bg-muted'
                }`}
              />
              {stepNumber < totalSteps && (
                <div
                  className={`w-8 h-0.5 ${
                    stepNumber < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {stepLabel || `Step ${currentStep} of ${totalSteps}`}
      </p>
    </div>
  );
}
