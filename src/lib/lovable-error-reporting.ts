// Only fixed diagnostic labels leave this module. Never forward an exception
// message, stack, wallet snapshot, form value, or arbitrary context to telemetry.
type Events = {
  captureException?: (
    error: Error,
    context: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => void;
};
declare global {
  interface Window {
    __lovableEvents?: Events;
    __lovableReportRuntimeError?: (payload: { message: string; filename?: string }) => void;
  }
}
export function reportLovableError(_error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const route = [
    "/",
    "/wallet",
    "/offers",
    "/activity",
    "/analyzer",
    "/about",
    "/settings",
  ].includes(window.location.pathname)
    ? window.location.pathname
    : "unknown";
  const boundary = context["boundary"] === "tanstack_root_error_component" ? "root" : "unknown";
  window.__lovableEvents?.captureException?.(
    new Error("CardWise page rendering failed"),
    { route, boundary },
    { mechanism: "react_error_boundary", handled: false, severity: "error" },
  );
  window.__lovableReportRuntimeError?.({
    message: "CardWise page rendering failed",
    filename: route,
  });
}
