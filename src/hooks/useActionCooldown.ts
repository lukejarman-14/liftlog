import { useCallback, useEffect, useState } from 'react';
import {
  type ActionCooldownScope,
  formatCooldown,
  getActionCooldownRemaining,
  startActionCooldown,
} from '../lib/actionCooldown';

export function useActionCooldown(scope: ActionCooldownScope, identifier: string) {
  const [remainingMs, setRemainingMs] = useState(() => getActionCooldownRemaining(scope, identifier));

  useEffect(() => {
    const update = () => setRemainingMs(getActionCooldownRemaining(scope, identifier));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [scope, identifier]);

  const start = useCallback(() => {
    startActionCooldown(scope, identifier);
    setRemainingMs(getActionCooldownRemaining(scope, identifier));
  }, [scope, identifier]);

  return {
    remainingMs,
    coolingDown: remainingMs > 0,
    label: formatCooldown(remainingMs),
    start,
  };
}

