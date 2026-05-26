import { useCallback, useEffect, useState } from "react";
import { notificationService } from "../services/notifications/notificationService";

export const useNotifications = (user) => {
  const [state, setState] = useState(() => notificationService.getState());

  useEffect(() => notificationService.subscribe(setState), []);

  useEffect(() => {
    if (!user?.username) return;
    notificationService.restore(user);
  }, [user?.username, user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setNotificationsEnabled = useCallback(
    async (enabled) => {
      if (enabled) {
        return notificationService.enable({ user });
      }
      return notificationService.disable({ user });
    },
    [user]
  );

  return {
    ...state,
    setNotificationsEnabled,
    enableNotifications: () => notificationService.enable({ user }),
    disableNotifications: () => notificationService.disable({ user }),
  };
};

export default useNotifications;
