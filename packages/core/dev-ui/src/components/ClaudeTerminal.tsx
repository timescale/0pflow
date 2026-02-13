import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

interface ClaudeTerminalProps {
  attachTo: (el: HTMLDivElement | null) => void;
  fit: () => void;
  ptyAlive: boolean;
  restart: () => void;
}

export function ClaudeTerminal({ attachTo, fit, ptyAlive, restart }: ClaudeTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach terminal to the container div
  useEffect(() => {
    if (containerRef.current) {
      attachTo(containerRef.current);
    }
    return () => attachTo(null);
  }, [attachTo]);

  // Resize terminal when container resizes (panel drag, window resize)
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(fit);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fit]);

  // Re-fit when component mounts (tab switch makes it visible)
  useEffect(() => {
    const timer = setTimeout(fit, 50);
    return () => clearTimeout(timer);
  }, [fit]);

  // Listen for Enter to restart when PTY is dead
  useEffect(() => {
    if (ptyAlive) return;
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        restart();
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [ptyAlive, restart]);

  return (
    <div className="h-full w-full overflow-hidden bg-[#1a1a1a] px-4 py-2">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
