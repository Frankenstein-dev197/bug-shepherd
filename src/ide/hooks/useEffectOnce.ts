import { useEffect } from 'react';

export function useEffectOnce(callback: () => void | (() => void)) {
  useEffect(() => {
    const cleanup = callback();
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
