export function isNotificationExtensionStatus(value: string): boolean {
  return value.trimStart().startsWith("[");
}

export function getNotificationExtensionStatuses(
  statuses: ReadonlyMap<string, string>,
): string[] {
  const notifications: string[] = [];
  for (const value of statuses.values()) {
    if (value && isNotificationExtensionStatus(value)) notifications.push(value);
  }
  return notifications;
}
