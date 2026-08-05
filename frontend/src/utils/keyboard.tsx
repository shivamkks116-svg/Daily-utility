/**
 * Drop-in replacement for the react-native-keyboard-controller components
 * we use across the app. Built on top of React Native's built-in
 * `KeyboardAvoidingView` + `ScrollView`.
 *
 * Why: removing react-native-keyboard-controller drastically shortens
 * native codegen paths on Windows (fixes MAX_PATH build failures) with
 * minimal UX cost.
 */
import React from "react";
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  KeyboardAvoidingViewProps,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewProps,
} from "react-native";

const iosBehavior: KeyboardAvoidingViewProps["behavior"] = "padding";
const androidBehavior: KeyboardAvoidingViewProps["behavior"] = "height";

export const KeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps> = ({
  children,
  behavior,
  style,
  ...rest
}) => (
  <RNKeyboardAvoidingView
    style={style}
    behavior={behavior ?? (Platform.OS === "ios" ? iosBehavior : androidBehavior)}
    {...rest}
  >
    {children}
  </RNKeyboardAvoidingView>
);

/** Was KeyboardStickyView — sticks children above the keyboard when it opens. */
export const KeyboardStickyView: React.FC<ViewProps> = ({ children, style, ...rest }) => (
  <RNKeyboardAvoidingView
    behavior={Platform.OS === "ios" ? iosBehavior : undefined}
    style={StyleSheet.flatten([{ width: "100%" }, style])}
    {...(rest as any)}
  >
    <View>{children}</View>
  </RNKeyboardAvoidingView>
);

type KAScrollProps = ScrollViewProps & {
  bottomOffset?: number; // accepted for API compatibility, not used here
};

/** Was KeyboardAwareScrollView — auto-scrolls to focused input; here we
 *  fall back to KeyboardAvoidingView + ScrollView which is enough for our forms. */
export const KeyboardAwareScrollView: React.FC<KAScrollProps> = ({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps,
  bottomOffset: _bottomOffset,
  style,
  ...rest
}) => (
  <RNKeyboardAvoidingView
    behavior={Platform.OS === "ios" ? iosBehavior : undefined}
    style={{ flex: 1 }}
  >
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? "handled"}
      style={style}
      {...rest}
    >
      {children}
    </ScrollView>
  </RNKeyboardAvoidingView>
);

/** Was KeyboardProvider — no-op now, kept so root layout doesn't need edits. */
export const KeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
