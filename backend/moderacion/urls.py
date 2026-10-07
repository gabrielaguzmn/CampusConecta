from django.urls import path

from moderacion import views

urlpatterns = [
    path("normas/", views.NormasView.as_view(), name="normas"),
    path("eventos/<int:pk>/reportes/", views.ReportarView.as_view(), name="reportar"),
    path("admin/casos/", views.AdminCasosView.as_view(), name="admin-casos"),
    path("admin/casos/<int:pk>/", views.AdminCasoView.as_view(), name="admin-caso"),
    path("admin/eventos/", views.AdminEventosView.as_view(), name="admin-eventos"),
    path("admin/eventos/<int:pk>/ocultar/", views.AdminOcultarEventoView.as_view(), name="admin-evento-ocultar"),
    path("admin/eventos/<int:pk>/restaurar/", views.AdminRestaurarEventoView.as_view(), name="admin-evento-restaurar"),
    path("admin/fechas/<int:pk>/ocultar/", views.AdminOcultarFechaView.as_view(), name="admin-fecha-ocultar"),
    path("admin/fechas/<int:pk>/restaurar/", views.AdminRestaurarFechaView.as_view(), name="admin-fecha-restaurar"),
    path("admin/usuarios/<int:pk>/suspender/", views.AdminSuspenderView.as_view(), name="admin-suspender"),
    path("admin/usuarios/<int:pk>/reactivar/", views.AdminReactivarView.as_view(), name="admin-reactivar"),
    path("admin/registro/", views.AdminRegistroView.as_view(), name="admin-registro"),
    path("admin/registro/<int:pk>/", views.AdminRegistroDetalleView.as_view(), name="admin-registro-detalle"),
]
