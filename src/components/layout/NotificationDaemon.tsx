import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function NotificationDaemon() {
  const { user } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    // Run only once per session/mount for the authenticated user
    if (user && !hasRun.current) {
      hasRun.current = true;
      
      const checkDeadlines = async () => {
        try {
          // Calls the Postgres function to evaluate deadlines and create notifications if needed
          // @ts-expect-error type not updated yet
          await supabase.rpc("check_deadline_notifications", { _user_id: user.id });
        } catch (error) {
          console.error("Error running notification daemon:", error);
        }
      };

      checkDeadlines();
    }
  }, [user]);

  // This component doesn't render anything
  return null;
}
