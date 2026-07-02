import { CheckCircle2 } from "lucide-react";

export function WorkflowSteps({
  title = "ขั้นตอนการทำงาน",
  steps,
}: {
  title?: string;
  steps: Array<{ title: string; detail: string }>;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm" aria-label={title}>
      <div className="mb-3 text-xs font-semibold tracking-wide text-primary">{title}</div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-lg border bg-muted/15 p-3">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {step.title}
                {index === steps.length - 1 && <CheckCircle2 className="h-3.5 w-3.5 text-teal" />}
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
