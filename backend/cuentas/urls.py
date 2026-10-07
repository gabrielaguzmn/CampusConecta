from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from cuentas import views

urlpatterns = [
    path("registro/", views.RegistroView.as_view(), name="registro"),
    path("token/", views.TokenView.as_view(), name="token"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("yo/", views.UsuarioActualView.as_view(), name="usuario-actual"),
    path("recuperacion/", views.SolicitudRecuperacionView.as_view(), name="recuperacion"),
    path("recuperacion/confirmar/", views.ConfirmacionRecuperacionView.as_view(), name="recuperacion-confirmar"),
]
