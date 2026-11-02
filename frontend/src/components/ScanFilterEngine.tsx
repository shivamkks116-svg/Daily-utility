/**
 * Offline scan filter engine. Renders an invisible WebView (native) that runs
 * canvas-based filters on-device. On web it runs the same code in the page.
 */
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SCAN_FILTER_JS } from "@/src/utils/image/scanFilterScript";

let WebView: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require("react-native-webview").WebView;
}

export type ScanFilterMode = "bw" | "boost";
export type ScanFilterEngineRef = { run: (src: string, mode: ScanFilterMode) => Promise<string> };

type Job = { resolve: (v: string) => void; reject: (e: Error) => void };

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><script>${SCAN_FILTER_JS}
window.__run = function (id, src, mode) {
  window.__scanFilter(src, mode).then(function (out) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, out: out }));
  }).catch(function (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, error: String(e && e.message || e) }));
  });
};
window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
</script></body></html>`;

let webReady = false;
function runOnWeb(src: string, mode: ScanFilterMode): Promise<string> {
  const w = globalThis as any;
  if (!webReady) {
    new Function(SCAN_FILTER_JS)();
    webReady = true;
  }
  return w.__scanFilter(src, mode);
}

export const ScanFilterEngine = forwardRef<ScanFilterEngineRef>(function ScanFilterEngine(_, ref) {
  const web = useRef<any>(null);
  const jobs = useRef<Record<string, Job>>({});
  const ready = useRef(false);
  const waiting = useRef<(() => void)[]>([]);
  const seq = useRef(0);

  useImperativeHandle(ref, () => ({
    run: (src, mode) => {
      if (Platform.OS === "web") return runOnWeb(src, mode);
      return new Promise<string>((resolve, reject) => {
        const id = String(++seq.current);
        jobs.current[id] = { resolve, reject };
        const send = () =>
          web.current?.injectJavaScript(`window.__run(${JSON.stringify(id)}, ${JSON.stringify(src)}, ${JSON.stringify(mode)}); true;`);
        if (ready.current) send();
        else waiting.current.push(send);
      });
    },
  }));

  if (!WebView) return null;

  const onMessage = (e: any) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.ready) {
      ready.current = true;
      waiting.current.splice(0).forEach((fn) => fn());
      return;
    }
    const job = jobs.current[msg.id];
    if (!job) return;
    delete jobs.current[msg.id];
    if (msg.error) job.reject(new Error(msg.error));
    else job.resolve(msg.out);
  };

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={web}
        originWhitelist={["*"]}
        source={{ html: HTML }}
        javaScriptEnabled
        onMessage={onMessage}
        style={styles.hidden}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
