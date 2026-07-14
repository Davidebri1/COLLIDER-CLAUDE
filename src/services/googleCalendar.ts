// Thin wrapper around the Google Calendar v3 and Tasks v1 REST APIs. Callers
// must supply a valid access token (see googleAuth.ts's getValidAccessToken).
// Minimal types — just what this app needs, not the full Google schema.

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const TASKS_BASE = "https://tasks.googleapis.com/tasks/v1";

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
};

export type GoogleTaskList = {
  id: string;
  title: string;
};

export type GoogleTask = {
  id: string;
  title: string;
  due?: string;
  status?: string;
};

class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GoogleApiError(`Google API error ${res.status}: ${body}`, res.status);
  }
  // DELETE responses are typically empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ── Calendar ─────────────────────────────────────────────────────────────

export async function listUpcomingEvents(
  accessToken: string,
  opts?: { maxResults?: number }
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(opts?.maxResults ?? 20),
  });
  const data = await apiFetch<{ items?: GoogleCalendarEvent[] }>(
    `${CALENDAR_BASE}/calendars/primary/events?${params.toString()}`,
    accessToken
  );
  return data.items || [];
}

export async function createCalendarEvent(
  accessToken: string,
  event: { title: string; start: Date; end: Date; description?: string }
): Promise<GoogleCalendarEvent> {
  return apiFetch<GoogleCalendarEvent>(
    `${CALENDAR_BASE}/calendars/primary/events`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      }),
    }
  );
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  await apiFetch<void>(
    `${CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: "DELETE" }
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────

export async function listTaskLists(accessToken: string): Promise<GoogleTaskList[]> {
  const data = await apiFetch<{ items?: GoogleTaskList[] }>(
    `${TASKS_BASE}/users/@me/lists`,
    accessToken
  );
  return data.items || [];
}

export async function createTask(
  accessToken: string,
  taskListId: string,
  task: { title: string; due?: Date }
): Promise<GoogleTask> {
  return apiFetch<GoogleTask>(
    `${TASKS_BASE}/lists/${encodeURIComponent(taskListId)}/tasks`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        title: task.title,
        due: task.due ? task.due.toISOString() : undefined,
      }),
    }
  );
}

export async function completeTask(
  accessToken: string,
  taskListId: string,
  taskId: string
): Promise<GoogleTask> {
  return apiFetch<GoogleTask>(
    `${TASKS_BASE}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    }
  );
}
