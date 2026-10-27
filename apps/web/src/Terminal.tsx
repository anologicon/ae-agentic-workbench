import { useEffect, useRef } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
export function Terminal({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const terminal = new XTerminal({
      cursorBlink: true,
      fontFamily: '"SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      theme: {
        background: "#111714",
        foreground: "#dce6df",
        cursor: "#a6ce87",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(ref.current!);
    fit.fit();
    const socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/terminals/${id}`,
    );
    const resize = () => {
      fit.fit();
      if (socket.readyState === WebSocket.OPEN)
        socket.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          }),
        );
    };
    socket.onopen = resize;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "data") terminal.write(message.data);
      else if (message.type === "exit")
        terminal.writeln(`\r\n[processo encerrado: ${message.exitCode}]`);
    };
    socket.onclose = () => terminal.writeln("\r\n[terminal desconectado]");
    const subscription = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "input", data }));
    });
    const observer = new ResizeObserver(resize);
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      subscription.dispose();
      socket.close();
      terminal.dispose();
    };
  }, [id]);
  return <div ref={ref} className="terminal" />;
}
