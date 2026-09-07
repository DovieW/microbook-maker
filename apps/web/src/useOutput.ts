import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderJob } from '@microbook/core';
import { post } from './api';
export type OutputAction = 'print' | 'download';
export function useOutput() {
  const [fallback, setFallback] = useState<RenderJob>();
  const [preparing, setPreparing] = useState(false);
  const cleanup = useRef<() => void>(() => {});
  const token = useRef(0);
  const cancel = useCallback(() => {
    token.current++;
    cleanup.current();
    setPreparing(false);
    setFallback(undefined);
  }, []);
  useEffect(() => () => cleanup.current(), []);
  const perform = useCallback(
    async (job: RenderJob, action: OutputAction) => {
      cancel();
      const sequence = token.current;
      await post(`/api/renders/${job.id}/lease`);
      if (sequence !== token.current) return;
      if (action === 'download') {
        const a = document.createElement('a');
        a.href = `/api/renders/${job.id}/download`;
        a.download = '';
        a.click();
        return;
      }
      if (!navigator.pdfViewerEnabled) {
        setFallback(job);
        return;
      }
      setPreparing(true);
      const frame = document.createElement('iframe');
      frame.className = 'native-print-frame';
      frame.title = 'Print PDF';
      frame.setAttribute('aria-hidden', 'true');
      frame.src = `/api/renders/${job.id}/pdf`;
      const lease = setInterval(() => void post(`/api/renders/${job.id}/lease`).catch(() => {}), 120000);
      let printTimer: ReturnType<typeof setTimeout>;
      const fail = () => {
        if (sequence === token.current) {
          cleanup.current();
          setPreparing(false);
          setFallback(job);
        }
      };
      const timeout = setTimeout(fail, 20000);
      cleanup.current = () => {
        clearTimeout(timeout);
        clearTimeout(printTimer);
        clearInterval(lease);
        frame.remove();
      };
      frame.onerror = fail;
      frame.onload = () => {
        clearTimeout(timeout);
        printTimer = setTimeout(() => {
          if (sequence !== token.current) return;
          try {
            frame.contentWindow!.addEventListener(
              'afterprint',
              () => {
                if (sequence !== token.current) return;
                cleanup.current();
                setPreparing(false);
              },
              { once: true },
            );
            frame.contentWindow!.focus();
            frame.contentWindow!.print();
            setPreparing(false);
          } catch {
            fail();
          }
        }, 500);
      };
      document.body.append(frame);
    },
    [cancel],
  );
  return { perform, cancel, fallback, preparing };
}
