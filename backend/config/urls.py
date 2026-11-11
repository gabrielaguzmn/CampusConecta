from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView
from rest_framework.permissions import AllowAny

from cuentas.urls import urlpatterns_admin

urlpatterns = [
    path("api/auth/", include("cuentas.urls")),
    path("api/", include("eventos.urls")),
    path("api/", include("moderacion.urls")),
path("api/voice/", include("voice_assistant.urls")),
    path("api/admin/usuarios/", include(urlpatterns_admin)),
    path("api/schema/", SpectacularAPIView.as_view(permission_classes=[AllowAny]), name="schema"),
]

# Solo en desarrollo; en producción las imágenes las sirve el servidor web (G-42).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
