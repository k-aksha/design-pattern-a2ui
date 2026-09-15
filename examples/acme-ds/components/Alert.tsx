export type AlertProps = {
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
};

export function Alert({ message, tone = "info" }: AlertProps) {
  return <div role="status" data-tone={tone}>{message}</div>;
}
