// Shared map control cluster (bottom-right): waypoint-label toggle, zoom
// buttons, and North-up / Heading-up orientation. Rendered identically over
// both map implementations — SvgMap feeds it viewport math, LibreMap feeds
// it camera commands. Extracted verbatim from SvgMap (2026-09-21) so the two
// views can't drift apart; the columns sit either side of the 2×2 rail axis.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../theme";

export type Orientation = "north" | "heading";

interface Props {
  labelsOn: boolean;
  onToggleLabels: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  orientation: Orientation;
  onOrient: (o: Orientation) => void;
}

export default function MapControls({ labelsOn, onToggleLabels, onZoomIn, onZoomOut, orientation, onOrient }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <View style={[styles.buttonCol, { bottom: 24 + insets.bottom, right: 21 }]}>
        <Pressable
          style={[styles.modeButton, labelsOn && styles.modeOn]}
          onPress={onToggleLabels}
          accessibilityLabel="Toggle waypoint labels"
        >
          <Text style={[styles.modeText, labelsOn && { color: COLORS.bg }]}>🏷</Text>
        </Pressable>
        <Pressable style={styles.zoomButton} onPress={onZoomIn} accessibilityLabel="Zoom in">
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
        <Pressable style={styles.zoomButton} onPress={onZoomOut} accessibilityLabel="Zoom out">
          <Text style={styles.zoomText}>−</Text>
        </Pressable>
      </View>
      <View style={[styles.buttonCol, { bottom: 24 + insets.bottom, right: 89 }]}>
        <Pressable
          style={[styles.modeButton, orientation === "north" && styles.modeOn]}
          onPress={() => onOrient("north")}
          accessibilityLabel="North up and re-centre"
        >
          <Text style={[styles.modeText, orientation === "north" && { color: COLORS.bg }]}>N↑</Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, orientation === "heading" && styles.modeOn]}
          onPress={() => onOrient("heading")}
          accessibilityLabel="Heading up and re-centre"
        >
          <Text style={[styles.modeText, orientation === "heading" && { color: COLORS.bg }]}>H↑</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // zoom column centred on the rail axis (rail centre = W-50; buttons 58 wide)
  buttonCol: { position: "absolute", gap: 10 },
  zoomButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(27,32,39,0.95)",
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomText: { color: COLORS.text, fontSize: 28, fontWeight: "800", lineHeight: 30 },
  modeButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(27,32,39,0.95)",
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
  },
  modeOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  modeText: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
});
