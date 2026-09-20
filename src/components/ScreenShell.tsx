// Common chrome for the non-map screens: a header with a back-to-map button.
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../theme";

export default function ScreenShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.mapButton} onPress={onBack} accessibilityLabel="Back to map">
          <Text style={styles.mapGlyph}>◀</Text>
          <Text style={styles.mapLabel}>MAP</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.panel,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  mapButton: {
    width: 76,
    height: 56,
    borderRadius: 10,
    backgroundColor: "rgba(27,32,39,0.95)",
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  mapGlyph: { color: COLORS.accent, fontSize: 20, fontWeight: "900", lineHeight: 24 },
  mapLabel: { color: COLORS.accent, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  body: { flex: 1 },
  content: { padding: 16, gap: 12, alignItems: "flex-start" },
});
