import logging
from typing import Callable, Dict, List, Any

logger = logging.getLogger(__name__)

class EventBus:
    """
    Centralized Event Bus for Domain-Driven Design side-effects.
    Decouples core business logic from external integrations (ABDM, AI, Pharmacy).
    """
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.debug(f"Subscribed handler to {event_type}")

    def publish(self, event_type: str, payload: Any):
        logger.info(f"Publishing event: {event_type}")
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                try:
                    handler(payload)
                except Exception as e:
                    logger.error(f"Error handling event {event_type}: {str(e)}")

# Global instance for the application
domain_event_bus = EventBus()

# --- Example Handlers (to be moved to respective modules later) ---

def notify_pharmacy(payload):
    print(f"[EventBus -> Pharmacy] Notifying pharmacy for appointment {payload.get('appointment_uid')}")

def update_medical_timeline(payload):
    print(f"[EventBus -> Timeline] Updating timeline for appointment {payload.get('appointment_uid')}")

def trigger_analytics(payload):
    print(f"[EventBus -> Analytics] Triggering analytics for event {payload.get('status')}")

# Subscribe handlers
domain_event_bus.subscribe("APPOINTMENT_COMPLETED", notify_pharmacy)
domain_event_bus.subscribe("APPOINTMENT_COMPLETED", update_medical_timeline)
domain_event_bus.subscribe("APPOINTMENT_STATE_CHANGED", trigger_analytics)
