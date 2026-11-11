from django.conf import settings
from rest_framework.throttling import UserRateThrottle


class SemanticUserThrottle(UserRateThrottle):
    scope = "voice_semantic"

    def get_rate(self):
        return settings.VOICE_SEMANTIC["THROTTLE_RATE"]
