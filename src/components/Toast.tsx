// Global in-app toast / confirm system  replaces native alert()/confirm(),
// which are a web-only crutch: alert() blocks the JS thread and confirm()
// doesn't render at all on iOS/Android. Mirrors the visual language of the
// old Shell() toastText/toastContainer pattern in App.tsx, generalized so
// any screen can call useToast() instead of window.alert/window.confirm.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { styles } from "../styles/theme";
import { GlossSurface } from "./GlossSurface";

type ToastItem = { id: number; message: string };
type ConfirmState = {
  message: string;
  resolve: (v: boolean) => void;
} | null;

type ToastContextValue = {
  toast: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft rather than crash the app if a screen forgets the provider.
    return {
      toast: (m: string) => console.warn("[toast, no provider]", m),
      confirm: async (m: string) => {
        console.warn("[confirm, no provider]", m);
        return false;
      },
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const idRef = useRef(0);

  const toast = useCallback((message: string) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const handleConfirmResult = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {items.length > 0 && (
        <View style={styles.toastContainer} pointerEvents="none">
          {items.map((item) => (
            <BlurView key={item.id} intensity={90} tint="dark" style={[styles.toastBlur, { marginBottom: 8 }]}>
              <Text style={styles.toastText}>{item.message}</Text>
            </BlurView>
          ))}
        </View>
      )}

      {confirmState && (
        <Modal transparent visible animationType="fade" onRequestClose={() => handleConfirmResult(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => handleConfirmResult(false)}>
            <View
              style={[styles.editSheet, { width: 300, marginTop: 0, padding: 20, overflow: "hidden" }]}
              onStartShouldSetResponder={() => true}
            >
              <GlossSurface borderRadius={22} />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 18, lineHeight: 21 }}>
                {confirmState.message}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => handleConfirmResult(false)}
                  style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: "rgba(255,255,255,0.12)" }]}
                >
                  <Text style={[styles.primaryText, { color: "#fff" }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleConfirmResult(true)}
                  style={[styles.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: "#ef4444" }]}
                >
                  <Text style={[styles.primaryText, { color: "#fff" }]}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </ToastContext.Provider>
  );
}
