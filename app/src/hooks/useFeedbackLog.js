import { useEffect, useState } from 'react';
import { FEEDBACK_EVENT } from '../lib/feedbackEvents';

export function useFeedbackLog(limit = 12) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const onFeedback = (event) => {
      setEvents((prev) => [event.detail, ...prev].slice(0, limit));
    };
    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, [limit]);

  return events;
}
