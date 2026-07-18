import { ReminderEditModal } from "../../App";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  LayoutAnimation,
  ActivityIndicator,
  Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCollider, newId, type Reminder } from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { styles, withFont, fontFamilyForWeight } from "../styles/theme";
import { SearchBar, useSearch } from "../features";
import { convertItem } from "../services/smartgen";
import { useToast } from "../components/Toast";
import { signInWithGoogle, signOutGoogle, getValidAccessToken, isGoogleConnected } from "../services/googleAuth";
import { listUpcomingEvents, createCalendarEvent, createTask, deleteCalendarEvent, deleteTask, updateCalendarEvent, updateTask, listTaskLists, type GoogleCalendarEvent, type GoogleTaskList } from "../services/googleCalendar";
import { SelectionBar, SelectModeToggle, SelectDot } from "../components/SelectionBar";

export function RemindersScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const handleBulkDelete = () => {
    dispatch({ type: "removeReminders", ids: Array.from(selectedIds) });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    exitSelectMode();
  };

  // ── Google Calendar / Tasks connection ──────────────────────────────────
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null); // null = still checking
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [syncingReminderId, setSyncingReminderId] = useState<string | null>(null);
  const [taskingReminderId, setTaskingReminderId] = useState<string | null>(null);

  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>("@default");

  const refreshGoogleEvents = useCallback(async () => {
    const token = await getValidAccessToken();
    if (!token) {
      setGoogleConnected(false);
      setGoogleEvents([]);
      setTaskLists([]);
      return;
    }
    setGoogleConnected(true);
    try {
      const events = await listUpcomingEvents(token, { maxResults: 10 });
      setGoogleEvents(events);
      const lists = await listTaskLists(token);
      setTaskLists(lists);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    (async () => {
      const connected = await isGoogleConnected();
      setGoogleConnected(connected);
      if (connected) refreshGoogleEvents();
    })();
  }, [refreshGoogleEvents]);

  const handleConnectGoogle = async () => {
    setGoogleBusy(true);
    try {
      const tokens = await signInWithGoogle();
      if (!tokens) {
        toast("Google sign-in was cancelled or denied. If your account isn't a test user on the OAuth consent screen yet, it needs to be added there first.");
        setGoogleBusy(false);
        return;
      }
      setGoogleConnected(true);
      toast("Connected to Google Calendar.");
      await refreshGoogleEvents();
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await signOutGoogle();
    setGoogleConnected(false);
    setGoogleEvents([]);
    toast("Disconnected from Google Calendar.");
  };

  const handleSyncReminderToCalendar = async (r: Reminder) => {
    if (!r.due) return;
    setSyncingReminderId(r.id);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        toast("Connect Google Calendar first.");
        setGoogleConnected(false);
        return;
      }
      const start = new Date(r.due);
      const end = new Date(r.due + 60 * 60 * 1000);
      const event = await createCalendarEvent(token, { title: r.title, start, end });
      dispatch({ type: "updateReminder", reminder: { ...r, googleEventId: event.id } });
      toast("Synced to Google Calendar.");
      refreshGoogleEvents();
    } catch {
      toast("Couldn't sync to Google Calendar. Try again.");
    } finally {
      setSyncingReminderId(null);
    }
  };

  const handleSendReminderToTasks = async (r: Reminder) => {
    setTaskingReminderId(r.id);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        toast("Connect Google Calendar first.");
        setGoogleConnected(false);
        return;
      }
      const task = await createTask(token, selectedTaskListId, {
        title: r.title,
        due: r.due ? new Date(r.due) : undefined,
      });
      dispatch({ type: "updateReminder", reminder: { ...r, googleTaskId: task.id } });
      toast("Sent to Google Tasks.");
    } catch {
      toast("Couldn't send to Google Tasks. Try again.");
    } finally {
      setTaskingReminderId(null);
    }
  };

  const calendarDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstDayIndex; i++) list.push(null);
    for (let i = 1; i <= totalDays; i++) list.push(new Date(year, month, i));
    return list;
  }, []);

  const hasReminder = (date: Date) => {
    return state.reminders.some((r) => r.due && new Date(r.due).toDateString() === date.toDateString());
  };

  const { q, setQ, filtered } = useSearch(state.reminders, (r) => r.title);

  // Sortable table columns — clicking a header toggles direction, clicking a
  // different column switches to it ascending first.
  const [sortBy, setSortBy] = useState<"title" | "due" | "priority" | "status">("due");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const handleSort = (col: typeof sortBy) => {
    Haptics.selectionAsync().catch(() => {});
    if (col === sortBy) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortBy(col); setSortDir(1); }
  };
  const PRIORITY_ORDER: Record<string, number> = { high: 0, med: 1, low: 2, none: 3 };
  const STATUS_ORDER: Record<string, number> = { todo: 0, inprogress: 1, done: 2 };

  const displayedList = useMemo(() => {
    let list = filtered;
    if (selectedCalendarDate) {
      list = list.filter((r) => r.due && new Date(r.due).toDateString() === selectedCalendarDate.toDateString());
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "due") cmp = (a.due ?? Infinity) - (b.due ?? Infinity);
      else if (sortBy === "priority") cmp = (PRIORITY_ORDER[a.priority || "none"] ?? 3) - (PRIORITY_ORDER[b.priority || "none"] ?? 3);
      else if (sortBy === "status") cmp = (STATUS_ORDER[a.progress || "todo"] ?? 0) - (STATUS_ORDER[b.progress || "todo"] ?? 0);
      return cmp * sortDir;
    });
    return sorted;
  }, [filtered, selectedCalendarDate, sortBy, sortDir]);

  const handleToggleReminder = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatch({ type: "toggleReminder", id });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  // "+" always opens the full form instead of silently creating a bare
  // title-only reminder — date/time, priority, and model are real fields on
  // that form, not something to guess out of free text later.
  const handleAddReminder = () => {
    const id = newId("r");
    const dueTime = selectedCalendarDate ? selectedCalendarDate.getTime() : undefined;
    const modelId = state.selectedModelIds[state.activeCategory]?.[0] || "global";
    const draft: Reminder = {
      id,
      title: value.trim() || "New Reminder",
      due: dueTime,
      done: false,
      ts: Date.now(),
      priority: "none",
      progress: "todo",
      isTask: false,
      modelId,
    } as Reminder;
    dispatch({ type: "reminder", id, title: draft.title, due: dueTime, fingerprint: id });
    setValue("");
    setEditingItem(draft);
  };

  const handleDeleteReminder = async (id: string) => {
    const reminder = state.reminders.find((r) => r.id === id);
    dispatch({ type: "removeReminder", id });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (reminder && googleConnected) {
      try {
        const token = await getValidAccessToken();
        if (token) {
          if (reminder.googleEventId) {
            await deleteCalendarEvent(token, reminder.googleEventId);
          }
          if (reminder.googleTaskId) {
            await deleteTask(token, "@default", reminder.googleTaskId);
          }
        }
      } catch (err) {
        console.error("Failed to delete synced Google item:", err);
      }
    }
  };

  const getPriorityColor = (p?: string) => {
    if (p === "high") return "#ef4444";
    if (p === "med") return "#ffb74d";
    if (p === "low") return "#5dbdff";
    return "#6b6478";
  };

  return (
    <Page title="Reminders" goBack={goBack}>
      <View style={{ flex: 1, backgroundColor: "#06040a" }}>
        
        {/* Calendar Picker Panel */}
        <View style={localStyles.calendarCard}>
          <Text style={localStyles.calendarTitle}>
            {new Date().toLocaleString("default", { month: "long", year: "numeric" }).toUpperCase()}
          </Text>
          
          {/* Weekday headers */}
          <View style={localStyles.weekdayRow}>
            {["S","M","T","W","T","F","S"].map((day, idx) => (
              <Text key={idx} style={localStyles.weekdayText}>{day}</Text>
            ))}
          </View>
          
          {/* Calendar grid cells */}
          <View style={localStyles.gridRow}>
            {calendarDays.map((d, i) => {
              if (!d) return <View key={`empty-${i}`} style={localStyles.dayCellEmpty} />;
              
              const isSelected = selectedCalendarDate && d.toDateString() === selectedCalendarDate.toDateString();
              const isToday = d.toDateString() === new Date().toDateString();
              const hasRem = hasReminder(d);
              
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedCalendarDate(isSelected ? null : d);
                  }}
                  style={[
                    localStyles.dayCell,
                    isToday && localStyles.dayCellToday,
                    isSelected && localStyles.dayCellSelected,
                  ]}
                >
                  <Text style={[
                    localStyles.dayCellText,
                    isToday && { color: "#ffb74d" },
                    isSelected && { color: "#000", fontWeight: "900", fontFamily: fontFamilyForWeight(900) }
                  ]}>
                    {d.getDate()}
                  </Text>
                  {hasRem && (
                    <View style={[
                      localStyles.remDot,
                      isSelected && { backgroundColor: "#000" }
                    ]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Google Calendar connection */}
        <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
          <View style={localStyles.googleCard}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 8 }}>
              <Ionicons
                name={googleConnected ? "checkmark-circle" : "logo-google"}
                size={16}
                color={googleConnected ? "#4ade80" : "#5dbdff"}
              />
              <Text style={localStyles.googleText}>
                {googleConnected === null
                  ? "Checking Google Calendar…"
                  : googleConnected
                  ? "Connected to Google Calendar"
                  : "Google Calendar not connected"}
              </Text>
            </View>
            {googleBusy ? (
              <ActivityIndicator size="small" color="#5dbdff" />
            ) : googleConnected ? (
              <Pressable onPress={handleDisconnectGoogle} style={localStyles.googleBtn}>
                <Text style={localStyles.googleBtnText}>Disconnect</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleConnectGoogle} style={[localStyles.googleBtn, { backgroundColor: "#5dbdff" }]}>
                <Text style={[localStyles.googleBtnText, { color: "#000" }]}>Connect</Text>
              </Pressable>
            )}
          </View>

          {googleConnected && googleEvents.length > 0 && (
            <View style={localStyles.googleEventsBox}>
              <Text style={localStyles.googleEventsTitle}>UPCOMING GOOGLE CALENDAR EVENTS</Text>
              {googleEvents.slice(0, 5).map((ev) => {
                const when = ev.start?.dateTime || ev.start?.date;
                return (
                  <Pressable
                    key={ev.id}
                    style={localStyles.googleEventRow}
                    onPress={() => ev.htmlLink && Linking.openURL(ev.htmlLink)}
                  >
                    <Ionicons name="calendar-outline" size={11} color="#5dbdff" style={{ marginRight: 6 }} />
                    <Text style={localStyles.googleEventText} numberOfLines={1}>{ev.summary || "(untitled)"}</Text>
                    {when && (
                      <Text style={localStyles.googleEventDate}>
                        {new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {googleConnected && taskLists.length > 0 && (
            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0a0a0c", padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ color: "#858091", fontSize: 10, fontWeight: "700", fontFamily: fontFamilyForWeight(700), letterSpacing: 1 }}>GOOGLE TASKS LIST:</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flex: 1, marginLeft: 8 }}>
                {[{ id: "@default", title: "Default" }, ...taskLists].slice(0, 3).map((tl) => (
                  <Pressable
                    key={tl.id}
                    onPress={() => setSelectedTaskListId(tl.id)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: selectedTaskListId === tl.id ? "#fff" : "rgba(255,255,255,0.08)",
                      backgroundColor: selectedTaskListId === tl.id ? "#ffffff" : "transparent"
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "800", fontFamily: fontFamilyForWeight(800), color: selectedTaskListId === tl.id ? "#000" : "#6b6478" }}>
                      {tl.title.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Select-mode toggle + bulk action bar */}
        <View style={{ paddingHorizontal: 12, marginBottom: 8, flexDirection: "row", justifyContent: "flex-end" }}>
          <SelectModeToggle active={selectMode} onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))} />
        </View>
        <SelectionBar
          count={selectedIds.size}
          total={displayedList.length}
          onSelectAll={() => setSelectedIds(selectedIds.size >= displayedList.length ? new Set() : new Set(displayedList.map((r) => r.id)))}
          onClear={exitSelectMode}
          onDelete={handleBulkDelete}
        />

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <View style={localStyles.searchContainer}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search reminder notes..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={localStyles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick Add Reminder Box */}
        <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
          <View style={localStyles.addBox}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={selectedCalendarDate ? `Remind me on ${selectedCalendarDate.toLocaleDateString()} to...` : "Remind me to..."}
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={localStyles.addInput}
            />
            <Pressable
              onPress={handleAddReminder}
              style={localStyles.addButton}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Sortable table header — tap a column to sort by it, tap again to
            flip direction. Same fields every row below shows, just made
            explicit instead of implicit in a plain card list. */}
        {displayedList.length > 0 && (
          <View style={localStyles.tableHeader}>
            <View style={{ width: 26 }} />
            <Pressable onPress={() => handleSort("title")} style={[localStyles.headerCell, { flex: 1 }]}>
              <Text style={localStyles.headerCellText}>TITLE</Text>
              {sortBy === "title" && <Ionicons name={sortDir === 1 ? "chevron-up" : "chevron-down"} size={10} color="#ffffff" />}
            </Pressable>
            <Pressable onPress={() => handleSort("due")} style={[localStyles.headerCell, { width: 64 }]}>
              <Text style={localStyles.headerCellText}>DUE</Text>
              {sortBy === "due" && <Ionicons name={sortDir === 1 ? "chevron-up" : "chevron-down"} size={10} color="#ffffff" />}
            </Pressable>
            <Pressable onPress={() => handleSort("priority")} style={[localStyles.headerCell, { width: 50 }]}>
              <Text style={localStyles.headerCellText}>PRI</Text>
              {sortBy === "priority" && <Ionicons name={sortDir === 1 ? "chevron-up" : "chevron-down"} size={10} color="#ffffff" />}
            </Pressable>
            <Pressable onPress={() => handleSort("status")} style={[localStyles.headerCell, { width: 60 }]}>
              <Text style={localStyles.headerCellText}>STATUS</Text>
              {sortBy === "status" && <Ionicons name={sortDir === 1 ? "chevron-up" : "chevron-down"} size={10} color="#ffffff" />}
            </Pressable>
          </View>
        )}

        {/* Reminders List */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
          {displayedList.length === 0 ? (
            <View style={localStyles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
              <Text style={styles.muted}>
                {selectedCalendarDate ? "No reminders due on this date." : "No reminders yet. Add one above."}
              </Text>
            </View>
          ) : (
            displayedList.map((r) => {
              const isSelected = selectedIds.has(r.id);
              return (
              <Glass
                key={r.id}
                style={[localStyles.reminderCard, isSelected && { borderColor: "rgba(255,255,255,0.5)" }]}
              >
                {/* Title gets its own full-width row. Packing DUE/PRI/STATUS
                    plus the edit/delete/sync action icons onto the same row
                    as the title (the previous layout) left barely any space
                    for the title on a phone-width card — flexbox obediently
                    shrank the title's flex:1 box down to 0px whenever the
                    fixed-width columns plus the icon cluster added up to
                    more than the card's actual width, making the title
                    disappear rather than just truncate. A second row for
                    the metadata guarantees the title always gets the full
                    card width to itself. */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 26, alignItems: "center" }}>
                    {selectMode ? (
                      <Pressable onPress={() => toggleSelected(r.id)}>
                        <SelectDot selected={isSelected} />
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => handleToggleReminder(r.id)}>
                        <Ionicons
                          name={r.done ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={r.done ? "#ffffff" : "rgba(255,255,255,0.4)"}
                        />
                      </Pressable>
                    )}
                  </View>

                  <Pressable onPress={() => (selectMode ? toggleSelected(r.id) : setEditingItem(r))} style={{ flex: 1 }}>
                    <Text style={[
                      localStyles.reminderTitle,
                      r.done && { textDecorationLine: "line-through", color: "rgba(255,255,255,0.3)" }
                    ]} numberOfLines={2}>
                      {r.title}
                    </Text>
                  </Pressable>
                </View>

                {/* Due / Priority / Status — same fixed widths as the table
                    header above, right-aligned within this second row so
                    they still line up under the header's own right-anchored
                    DUE/PRI/STATUS columns. */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <View style={{ flex: 1 }} />
                  <View style={{ width: 64 }}>
                    {r.due && <Text style={localStyles.metaText} numberOfLines={1}>{new Date(r.due).toLocaleDateString()}</Text>}
                  </View>
                  <View style={{ width: 50 }}>
                    {r.priority && r.priority !== "none" && (
                      <View style={[
                        localStyles.priorityBadge,
                        { alignSelf: "flex-start", backgroundColor: `${getPriorityColor(r.priority)}15`, borderColor: `${getPriorityColor(r.priority)}30` }
                      ]}>
                        <Text style={[localStyles.priorityText, { color: getPriorityColor(r.priority) }]}>
                          {r.priority.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ width: 60 }}>
                    {r.progress && (
                      <Text style={[localStyles.metaText, { textTransform: "uppercase" }]} numberOfLines={1}>{r.progress}</Text>
                    )}
                  </View>

                  {/* Edit & Delete Action row */}
                  <View style={{ flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    {googleConnected && r.due && (
                      <Pressable
                        onPress={() => !r.googleEventId && handleSyncReminderToCalendar(r)}
                        disabled={syncingReminderId === r.id || !!r.googleEventId}
                        style={[localStyles.actionButton, { backgroundColor: r.googleEventId ? "rgba(74,222,128,0.1)" : "rgba(93,189,255,0.08)" }]}
                      >
                        {syncingReminderId === r.id ? (
                          <ActivityIndicator size="small" color="#5dbdff" />
                        ) : (
                          <Ionicons
                            name={r.googleEventId ? "checkmark-done-outline" : "cloud-upload-outline"}
                            size={13}
                            color={r.googleEventId ? "#4ade80" : "#5dbdff"}
                          />
                        )}
                      </Pressable>
                    )}
                    {googleConnected && (
                      <Pressable
                        onPress={() => !r.googleTaskId && handleSendReminderToTasks(r)}
                        disabled={taskingReminderId === r.id || !!r.googleTaskId}
                        style={[localStyles.actionButton, { backgroundColor: r.googleTaskId ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.08)" }]}
                      >
                        {taskingReminderId === r.id ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Ionicons
                            name={r.googleTaskId ? "checkmark-done-outline" : "list-outline"}
                            size={13}
                            color={r.googleTaskId ? "#4ade80" : "#ffffff"}
                          />
                        )}
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setConvertFor(convertFor === r.id ? null : r.id)}
                      style={[localStyles.actionButton, { backgroundColor: "rgba(93,189,255,0.08)" }]}
                    >
                      <Ionicons name="swap-horizontal-outline" size={13} color="#5dbdff" />
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingItem(r)}
                      style={localStyles.actionButton}
                    >
                      <Ionicons name="create-outline" size={13} color="#ffffff" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteReminder(r.id)}
                      style={[localStyles.actionButton, { backgroundColor: "rgba(239, 68, 68, 0.08)" }]}
                    >
                      <Ionicons name="trash-outline" size={13} color="#ef4444" />
                    </Pressable>
                  </View>
                  {convertFor === r.id && (
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable onPress={() => {
                        dispatch({ type: "memory", ...convertItem(r, "reminder", "memory"), linkFrom: { kind: "reminder", id: r.id } } as any);
                        handleDeleteReminder(r.id);
                        toast("Converted to Memory.");
                        setConvertFor(null);
                      }}>
                        <Text style={{ fontSize: 10, color: "#ffffff", fontWeight: "700", fontFamily: fontFamilyForWeight(700) }}> Memory</Text>
                      </Pressable>
                      <Pressable onPress={() => {
                        dispatch({ type: "artifact", ...convertItem(r, "reminder", "artifact"), linkFrom: { kind: "reminder", id: r.id } } as any);
                        handleDeleteReminder(r.id);
                        toast("Converted to Artifact.");
                        setConvertFor(null);
                      }}>
                        <Text style={{ fontSize: 10, color: "#ffffff", fontWeight: "700", fontFamily: fontFamilyForWeight(700) }}> Artifact</Text>
                      </Pressable>
                    </View>
                  )}
                  </View>
                </View>

              </Glass>
              );
            })
          )}
        </ScrollView>
      </View>

      {editingItem && (
        <ReminderEditModal
          visible={!!editingItem}
          item={editingItem}
          dispatch={dispatch}
          state={state}
          onClose={() => setEditingItem(null)}
          onSave={async (updated) => {
            dispatch({ type: "updateReminder", reminder: updated });
            setEditingItem(null);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            if (googleConnected) {
              try {
                const token = await getValidAccessToken();
                if (token) {
                  if (updated.googleEventId && updated.due) {
                    const start = new Date(updated.due);
                    const end = new Date(updated.due + 60 * 60 * 1000);
                    await updateCalendarEvent(token, updated.googleEventId, {
                      title: updated.title,
                      start,
                      end,
                    });
                  }
                  if (updated.googleTaskId) {
                    await updateTask(token, "@default", updated.googleTaskId, {
                      title: updated.title,
                      due: updated.due ? new Date(updated.due) : undefined,
                    });
                  }
                }
              } catch (err) {
                console.error("Failed to update synced Google item:", err);
              }
            }
          }}
          onDelete={(id) => {
            dispatch({ type: "removeReminder", id });
            setEditingItem(null);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }}
        />
      )}
    </Page>
  );
}

// withFont wraps every style with an explicit fontFamily matching its
// fontWeight (see styles/theme.ts). Without it, fontWeight 700+ on Text
// falls back to the OS's synthetic/faux-bold instead of the real static
// Manrope Bold/ExtraBold file — which is exactly what produced the
// inconsistent, oddly-thick "faux bold" text on this screen.
const localStyles = StyleSheet.create(withFont({
  googleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0a0a0c",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    height: 44,
  },
  googleText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11.5,
    fontWeight: "600", fontFamily: fontFamilyForWeight(600),
    flexShrink: 1,
  },
  googleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#0a0a0c",
  },
  googleBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700", fontFamily: fontFamilyForWeight(700),
  },
  googleEventsBox: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.015)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 10,
    gap: 6,
  },
  googleEventsTitle: {
    color: "#6b6478",
    fontSize: 9,
    fontWeight: "800", fontFamily: fontFamilyForWeight(800),
    letterSpacing: 1,
    marginBottom: 2,
  },
  googleEventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  googleEventText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600", fontFamily: fontFamilyForWeight(600),
    flex: 1,
  },
  googleEventDate: {
    color: "#6b6478",
    fontSize: 9,
    fontWeight: "700", fontFamily: fontFamilyForWeight(700),
    marginLeft: 6,
  },
  calendarCard: {
    backgroundColor: "#0a0a0c",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    width: "93%",
    alignSelf: "center",
    marginBottom: 14,
    marginTop: 8,
  },
  calendarTitle: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900", fontFamily: fontFamilyForWeight(900),
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 10,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  weekdayText: {
    color: "#6b6478",
    width: 34,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800", fontFamily: fontFamilyForWeight(800),
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    rowGap: 4,
  },
  dayCellEmpty: {
    width: "14.28%",
    aspectRatio: 1,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: "#ffb74d",
  },
  dayCellSelected: {
    backgroundColor: "#ffffff",
  },
  dayCellText: {
    fontSize: 11,
    fontWeight: "700", fontFamily: fontFamilyForWeight(700),
    color: "#fff",
  },
  remDot: {
    position: "absolute",
    bottom: 4,
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "#ffffff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0c",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    height: "100%",
    padding: 0
  },
  addBox: {
    flexDirection: "row",
    backgroundColor: "#0a0a0c",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    height: 40,
    alignItems: "center",
  },
  addInput: {
    flex: 1,
    color: "#fff",
    fontSize: 12.5,
    height: "100%",
    padding: 0,
  },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 6,
    gap: 6,
  },
  headerCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerCellText: {
    color: "#6b6478",
    fontSize: 9,
    fontWeight: "800", fontFamily: fontFamilyForWeight(800),
    letterSpacing: 0.5,
  },
  reminderCard: {
    borderRadius: 16,
    backgroundColor: "rgba(18,18,22,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "column",
    padding: 12,
  },
  reminderTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600", fontFamily: fontFamilyForWeight(600),
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#0a0a0c",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaText: {
    color: "#6b6478",
    fontSize: 9,
    fontWeight: "700", fontFamily: fontFamilyForWeight(700),
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 8,
    fontWeight: "800", fontFamily: fontFamilyForWeight(800),
  },
  actionButton: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: "#0a0a0c",
  },
}));
