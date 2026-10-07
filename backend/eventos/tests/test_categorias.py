from eventos.models import Categoria
from eventos.tests.base import BaseEventosTest


class CategoriasTests(BaseEventosTest):
    """CATEGORY-1"""

    def test_CATEGORY_1_c1_usuario_consulta_el_catalogo_inicial(self):
        nombres = [c["nombre"] for c in self.client.get("/api/categorias/").data]
        self.assertEqual(
            nombres,
            ["Ventas", "Talleres", "Entretenimiento", "Integración", "Deportes y recreación", "Cultura y arte"],
        )

    def test_CATEGORY_1_c2_administrador_crea_y_renombra(self):
        self.como(self.admin)
        creada = self.client.post("/api/admin/categorias/", {"nombre": "Voluntariado"}, format="json")
        self.assertEqual(creada.status_code, 201)
        renombrada = self.client.patch(f"/api/admin/categorias/{creada.data['id']}/", {"nombre": "Voluntariados"}, format="json")
        self.assertEqual(renombrada.status_code, 200)
        self.assertIn("Voluntariados", [c["nombre"] for c in self.client.get("/api/categorias/").data])

    def test_CATEGORY_1_c2_nombre_repetido_rechazado(self):
        self.como(self.admin)
        self.assertEqual(self.client.post("/api/admin/categorias/", {"nombre": "Ventas"}, format="json").status_code, 400)

    def test_CATEGORY_1_c3_desactivar_y_activar_ajusta_la_disponibilidad(self):
        self.como(self.admin)
        url = f"/api/admin/categorias/{self.categoria.pk}/"
        self.client.patch(url, {"activa": False}, format="json")
        self.como(self.creador)
        self.assertNotIn("Talleres", [c["nombre"] for c in self.client.get("/api/categorias/").data])
        self.assertEqual(self.client.post("/api/eventos/", self.datos_evento(), format="json").status_code, 400)
        self.como(self.admin)
        self.client.patch(url, {"activa": True}, format="json")
        self.como(self.creador)
        self.assertEqual(self.client.post("/api/eventos/", self.datos_evento(), format="json").status_code, 201)

    def test_CATEGORY_1_DoD_gestion_restringida_al_administrador(self):
        self.assertEqual(self.client.get("/api/admin/categorias/").status_code, 403)
        self.assertEqual(self.client.post("/api/admin/categorias/", {"nombre": "X"}, format="json").status_code, 403)
        url = f"/api/admin/categorias/{self.categoria.pk}/"
        self.assertEqual(self.client.patch(url, {"activa": False}, format="json").status_code, 403)
        self.assertTrue(Categoria.objects.get(pk=self.categoria.pk).activa)

    def test_CATEGORY_1_administrador_ve_tambien_las_inactivas(self):
        self.categoria.activa = False
        self.categoria.save()
        self.como(self.admin)
        self.assertIn("Talleres", [c["nombre"] for c in self.client.get("/api/admin/categorias/").data])
