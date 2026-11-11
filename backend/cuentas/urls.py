from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from cuentas import views
from cuentas.voz import TokenDeepgramView, VozAsistenteView

urlpatterns = [
    path("registro/", views.RegistroView.as_view(), name="registro"),
    path("token/", views.TokenView.as_view(), name="token"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("voz/token/", TokenDeepgramView.as_view(), name="voz-token"),
    path("voz/hablar/", VozAsistenteView.as_view(), name="voz-hablar"),
    path("yo/", views.UsuarioActualView.as_view(), name="usuario-actual"),
    path("recuperacion/", views.SolicitudRecuperacionView.as_view(), name="recuperacion"),
    path("recuperacion/confirmar/", views.ConfirmacionRecuperacionView.as_view(), name="recuperacion-confirmar"),
]

# ADMIN-3 y ADMIN-4: gestión de cuentas y roles (bajo /api/admin/usuarios/).
urlpatterns_admin = [
    path("", views.AdminUsuariosView.as_view(), name="admin-usuarios"),
    path("<int:pk>/asignar-admin/", views.CambioRolView.as_view(es_administrador=True), name="admin-asignar-admin"),
    path("<int:pk>/revocar-admin/", views.CambioRolView.as_view(es_administrador=False), name="admin-revocar-admin"),
]
