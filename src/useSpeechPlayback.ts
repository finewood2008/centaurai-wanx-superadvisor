import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "./bridge";
import { SpeechPlayback } from "./speechPlayback";

export function useSpeechPlayback() {
  const model = useRef(new SpeechPlayback());
  const [version, setVersion] = useState(0);
  const notify = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = setInterval(() => {
      if (model.current.advance(motion.matches)) notify();
    }, 90);
    return () => clearInterval(timer);
  }, [notify]);
  return {
    version,
    entries: model.current.visible(),
    active: model.current.active,
    reset: useCallback(() => {
      model.current.reset();
      notify();
    }, [notify]),
    history: useCallback(
      (messages: Message[], older = false) => {
        model.current.history(messages, older);
        notify();
      },
      [notify],
    ),
    token: useCallback(
      (agent: string, text: string) => {
        model.current.token(agent, text);
        notify();
      },
      [notify],
    ),
    done: useCallback(
      (agent?: string) => {
        model.current.done(agent);
        notify();
      },
      [notify],
    ),
    human: useCallback(
      (text: string) => {
        model.current.human(text);
        notify();
      },
      [notify],
    ),
    reveal: useCallback(() => {
      model.current.reveal();
      notify();
    }, [notify]),
  };
}
