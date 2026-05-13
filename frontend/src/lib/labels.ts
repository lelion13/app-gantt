import type { LifecycleStatus } from "@/types/api";

const statusMap: Record<LifecycleStatus, string> = {
  pending: "Pendiente",
  estimated: "Estimado",
  in_progress: "En progreso",
  completed: "Completado",
};

export function taskStatusLabel(s: LifecycleStatus): string {
  return statusMap[s] ?? s;
}
