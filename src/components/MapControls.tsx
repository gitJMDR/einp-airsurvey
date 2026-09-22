// Shared map control cluster (bottom-right): waypoint-label toggle, zoom
// buttons, and North-up / Heading-up orientation. Rendered identically over
// both map implementations — SvgMap feeds it viewport math, LibreMap feeds
// it camera commands. Extracted verbatim from SvgMap (2026-09-21) so the two
// views can't drift apart; the columns sit either side of the 2×2 rail axis.
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../theme";
import type { MapType } from "../types";

export type Orientation = "north" | "heading";

interface Props {
  labelsOn: boolean;
  onToggleLabels: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  orientation: Orientation;
  /** isDouble is true on the second tap of a quick same-button double-tap,
   *  which resets the zoom to the five-line default. */
  onOrient: (o: Orientation, isDouble: boolean) => void;
  /** Basemap switch — only provided by the real-map build (LibreMap). */
  mapType?: MapType;
  onToggleMapType?: () => void;
}

const DOUBLE_TAP_MS = 350;

export default function MapControls({
  labelsOn,
  onToggleLabels,
  onZoomIn,
  onZoomOut,
  orientation,
  onOrient,
  mapType,
  onToggleMapType,
}: Props) {
  const insets = useSafeAreaInsets();
  const lastOrientRef = useRef<{ o: Orientation; t: number } | null>(null);
  const handleOrient = (o: Orientation) => {
    const now = Date.now();
    const last = lastOrientRef.current;
    const isDouble = last != null && last.o === o && now - last.t < DOUBLE_TAP_MS;
    lastOrientRef.current = { o, t: now };
    onOrient(o, isDouble);
  };

  return (
    <>
      {/* left column of the 2×3 grid: basemap, orientation, zoom */}
      <View style={[styles.buttonCol, { bottom: 24 + insets.bottom, right: 89 }]}>
        {mapType != null && onToggleMapType != null && (
          <Pressable
            style={[styles.modeButton, styles.modeOn]}
            onPress={onToggleMapType}
            accessibilityLabel={mapType === "satellite" ? "Switch to road map" : "Switch to satellite imagery"}
          >
            <Text style={[styles.mapTypeText, { color: COLORS.bg }]}>{mapType === "satellite" ? "SAT" : "ROAD"}</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.modeButton, orientation === "north" && styles.modeOn]}
          onPress={() => handleOrient("north")}
          accessibilityLabel="North up and re-centre (double-tap also resets zoom)"
        >
          <Text style={[styles.modeText, orientation === "north" && { color: COLORS.bg }]}>N↑</Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, orientation === "heading" && styles.modeOn]}
          onPress={() => handleOrient("heading")}
          accessibilityLabel="Heading up and re-centre (double-tap also resets zoom)"
        >
          <Text style={[styles.modeText, orientation === "heading" && { color: COLORS.bg }]}>H↑</Text>
        </Pressable>
      </View>
      {/* right column: waypoint labels, zoom */}
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
  mapTypeText: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
});
