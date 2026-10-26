export type StepStatus = 'done' | 'current' | 'error' | 'todo';

const STEPS = ['Enter cube', 'Validate', 'Solve', 'Follow steps'] as const;

export function Stepper({ statuses }: { statuses: [StepStatus, StepStatus, StepStatus, StepStatus] }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className={`step step-${statuses[i]}`} aria-current={statuses[i] === 'current' ? 'step' : undefined}>
          <span className="step-num" aria-hidden="true">
            {statuses[i] === 'done' ? '✓' : statuses[i] === 'error' ? '!' : i + 1}
          </span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
