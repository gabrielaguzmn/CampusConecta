from django.urls import path

from eventos import views

urlpatterns = [
    path("categorias/", views.CategoriasView.as_view(), name="categorias"),
    path("admin/categorias/", views.AdminCategoriasView.as_view(), name="admin-categorias"),
    path("admin/categorias/<int:pk>/", views.AdminCategoriaView.as_view(), name="admin-categoria"),
    path("ubicaciones/", views.UbicacionesView.as_view(), name="ubicaciones"),
    path("eventos/", views.EventosView.as_view(), name="eventos"),
    path("eventos/<int:pk>/", views.EventoView.as_view(), name="evento"),
    path("eventos/<int:pk>/imagen/", views.EventoImagenView.as_view(), name="evento-imagen"),
    path("eventos/<int:pk>/fechas/", views.EventoFechasView.as_view(), name="evento-fechas"),
    path("eventos/<int:pk>/cancelar-todas/", views.CancelarTodasView.as_view(), name="evento-cancelar-todas"),
    path("mapa/", views.MapaView.as_view(), name="mapa"),
    path("mis-eventos/", views.MisEventosView.as_view(), name="mis-eventos"),
    path("fechas/<int:pk>/", views.FechaView.as_view(), name="fecha"),
    path("fechas/<int:pk>/cancelar/", views.CancelarFechaView.as_view(), name="fecha-cancelar"),
    path("fechas/<int:pk>/finalizar/", views.FinalizarFechaView.as_view(), name="fecha-finalizar"),
    path("fechas/<int:pk>/extender/", views.ExtenderFechaView.as_view(), name="fecha-extender"),
]
