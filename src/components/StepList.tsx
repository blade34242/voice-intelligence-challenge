export type StepItem = {
  key: string;
  label: string;
  state: "done" | "active" | "pending";
};

export function StepList(props: { steps: StepItem[] }) {
  return (
    <div className="step-list">
      {props.steps.map((step, index) => (
        <div key={step.key} className={`step-item ${step.state}`}>
          <span className="step-dot" />
          <span className="step-label">{step.label}</span>
          {index < props.steps.length - 1 ? <span className="step-line" /> : null}
        </div>
      ))}
    </div>
  );
}
