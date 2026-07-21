export type BackAction = "previous-step" | "confirm-exit" | "exit";

export function resolveBackAction(step: number, hasUnsavedData: boolean): BackAction {
  if (step > 1) return "previous-step";
  return hasUnsavedData ? "confirm-exit" : "exit";
}
