from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from eventos.models import CANCELADA, EN_VIVO, FINALIZADA, PROXIMA, Categoria, Fecha, Ubicacion
from eventos.tests.base import BaseEventosTest, en


class FeedTests(BaseEventosTest):
    """DISPLAY-1"""

    def feed(self, consulta=""):
        respuesta = self.client.get(f"/api/eventos/{consulta}")
        self.assertEqual(respuesta.status_code, 200)
        return [e["id"] for e in respuesta.data]

    def test_DISPLAY_1_c1_solo_eventos_con_fecha_proxima_o_en_vivo(self):
        proximo = self.crear_evento((24, 26))
        en_vivo = self.crear_evento((-1, 1))
        terminado = self.crear_evento((-5, -3))
        cancelado = self.crear_evento((24, 26))
        cancelado.fechas.update(cancelada=True)
        self.assertCountEqual(self.feed(), [proximo.pk, en_vivo.pk])
        self.assertNotIn(terminado.pk, self.feed())

    def test_DISPLAY_1_c1_requiere_sesion(self):
        self.assertEqual(APIClient().get("/api/eventos/").status_code, 401)

    def test_DISPLAY_1_c2_lista_de_varios_eventos_de_cualquier_creador(self):
        propio = self.crear_evento()
        ajeno = self.crear_evento(creador=self.otro)
        self.assertCountEqual(self.feed(), [propio.pk, ajeno.pk])

    def test_DISPLAY_1_c3_deja_de_aparecer_al_perder_la_vigencia(self):
        evento = self.crear_evento((24, 26))
        self.assertIn(evento.pk, self.feed())
        self.client.post(f"/api/fechas/{evento.fechas.get().pk}/cancelar/")
        self.assertNotIn(evento.pk, self.feed())

    def test_G37_del_mas_reciente_al_mas_antiguo(self):
        primero, segundo, tercero = self.crear_evento(), self.crear_evento(), self.crear_evento()
        self.assertEqual(self.feed(), [tercero.pk, segundo.pk, primero.pk])

    def test_G32_fecha_cancelada_se_muestra_marcada_en_evento_vigente(self):
        evento = self.crear_evento((-50, -48), (24, 26), (48, 50))
        Fecha.objects.filter(evento=evento, inicio__gt=en(40)).update(cancelada=True)
        estados = [f["estado"] for f in self.client.get("/api/eventos/").data[0]["fechas"]]
        self.assertEqual(estados, [FINALIZADA, PROXIMA, CANCELADA])

    def test_PUBLICATION_3_c3_edicion_visible_en_el_feed(self):
        fecha = self.crear_evento((24, 26)).fechas.get()
        nuevo_fin = en(30)
        self.client.patch(f"/api/fechas/{fecha.pk}/", {"fin": nuevo_fin.isoformat()}, format="json")
        self.assertEqual(parse_datetime(self.client.get("/api/eventos/").data[0]["fechas"][0]["fin"]), nuevo_fin)

    def test_PUBLICATION_5_c3_cancelar_todas_retira_del_feed(self):
        evento = self.crear_evento((-1, 1), (24, 26))
        self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/")
        self.assertNotIn(evento.pk, self.feed())

    def test_PUBLICATION_6_c3_finalizada_anticipadamente_deja_de_estar_en_vivo(self):
        evento = self.crear_evento((-1, 1))
        self.client.post(f"/api/fechas/{evento.fechas.get().pk}/finalizar/")
        self.assertNotIn(evento.pk, self.feed("?estado=en_vivo"))

    def test_RF032_contenido_oculto_no_aparece(self):
        oculto = self.crear_evento(oculto=True)
        con_unica_fecha_oculta = self.crear_evento((24, 26))
        con_unica_fecha_oculta.fechas.update(oculta=True)
        con_una_de_dos_oculta = self.crear_evento((24, 26), (48, 50))
        Fecha.objects.filter(pk=con_una_de_dos_oculta.fechas.first().pk).update(oculta=True)
        self.assertEqual(self.feed(), [con_una_de_dos_oculta.pk])
        fechas = self.client.get("/api/eventos/").data[0]["fechas"]
        self.assertEqual(len(fechas), 1)
        self.assertNotIn("oculta", fechas[0])
        self.assertNotIn(oculto.pk, self.feed())

    def test_ADMIN_3_c2_fechas_de_cuenta_suspendida_no_aparecen(self):
        evento = self.crear_evento(creador=self.otro)
        self.otro.is_active = False
        self.otro.save()
        self.assertNotIn(evento.pk, self.feed())
        self.otro.is_active = True
        self.otro.save()
        self.assertIn(evento.pk, self.feed())  # ADMIN-3 · criterio 3: se restablecen al reactivar


class FiltrosTests(BaseEventosTest):
    """DISPLAY-2 (sin filtro por fecha: decisión G-19 del 2026-10-07)."""

    def setUp(self):
        super().setUp()
        self.ventas = Categoria.objects.get(nombre="Ventas")
        self.taller_proximo = self.crear_evento((24, 26))
        self.taller_en_vivo = self.crear_evento((-1, 1))
        self.venta_mixta = self.crear_evento((-1, 1), (24, 26))
        self.venta_mixta.categoria = self.ventas
        self.venta_mixta.save()

    def feed(self, consulta):
        respuesta = self.client.get(f"/api/eventos/{consulta}")
        self.assertEqual(respuesta.status_code, 200)
        return sorted(e["id"] for e in respuesta.data)

    def test_DISPLAY_2_c1_filtra_por_categoria(self):
        self.assertEqual(self.feed(f"?categoria={self.ventas.pk}"), [self.venta_mixta.pk])

    def test_DISPLAY_2_c3_filtra_por_estado(self):
        self.assertEqual(self.feed("?estado=proxima"), sorted([self.taller_proximo.pk, self.venta_mixta.pk]))
        self.assertEqual(self.feed("?estado=en_vivo"), sorted([self.taller_en_vivo.pk, self.venta_mixta.pk]))

    def test_G33_evento_con_fechas_proximas_y_en_vivo_sale_en_ambos_filtros(self):
        self.assertIn(self.venta_mixta.pk, self.feed("?estado=proxima"))
        self.assertIn(self.venta_mixta.pk, self.feed("?estado=en_vivo"))

    def test_DISPLAY_2_c3_combina_categoria_y_estado(self):
        consulta = f"?categoria={self.categoria.pk}&estado=en_vivo"
        self.assertEqual(self.feed(consulta), [self.taller_en_vivo.pk])

    def test_DISPLAY_2_DoD_retirar_filtros_y_estado_vacio(self):
        self.assertEqual(len(self.feed("")), 3)
        cultura = Categoria.objects.get(nombre="Cultura y arte")
        self.assertEqual(self.feed(f"?categoria={cultura.pk}"), [])

    def test_DISPLAY_2_DoD_filtro_cancelada_no_cuenta_como_proxima(self):
        Fecha.objects.filter(evento=self.taller_proximo).update(cancelada=True)
        self.assertNotIn(self.taller_proximo.pk, self.feed("?estado=proxima"))

    def test_DISPLAY_2_parametros_invalidos(self):
        for consulta in ["?estado=finalizada", "?estado=cancelada", "?categoria=abc"]:
            self.assertEqual(self.client.get(f"/api/eventos/{consulta}").status_code, 400, consulta)


class MapaTests(BaseEventosTest):
    """INTERACTIVITY-1 e INTERACTIVITY-2 · criterio 1"""

    def mapa(self):
        respuesta = self.client.get("/api/mapa/")
        self.assertEqual(respuesta.status_code, 200)
        return respuesta.data

    def test_INTERACTIVITY_1_c1_eventos_vigentes_en_su_ubicacion_del_catalogo(self):
        evento = self.crear_evento((-1, 1))
        self.crear_evento((-5, -3))  # terminado: no aparece
        grupos = self.mapa()
        self.assertEqual(len(grupos), 1)
        self.assertEqual(grupos[0]["ubicacion"]["id"], self.ubicacion.pk)
        self.assertEqual([e["id"] for e in grupos[0]["eventos"]], [evento.pk])

    def test_INTERACTIVITY_1_c1_requiere_sesion(self):
        self.assertEqual(APIClient().get("/api/mapa/").status_code, 401)

    def test_INTERACTIVITY_1_c2_varios_eventos_en_una_misma_ubicacion(self):
        otra = Ubicacion.objects.create(nombre="Biblioteca")
        a, b, c = self.crear_evento(), self.crear_evento(), self.crear_evento()
        c.ubicacion = otra
        c.save()
        grupos = {g["ubicacion"]["nombre"]: [e["id"] for e in g["eventos"]] for g in self.mapa()}
        self.assertCountEqual(grupos["Edificio de prueba"], [a.pk, b.pk])
        self.assertEqual(grupos["Biblioteca"], [c.pk])

    def test_INTERACTIVITY_1_c3_deja_de_mostrarse_al_perder_la_vigencia(self):
        evento = self.crear_evento((24, 26))
        self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/")
        self.assertEqual(self.mapa(), [])

    def test_INTERACTIVITY_2_c1_pin_con_informacion_basica(self):
        self.crear_evento((-1, 1), detalle_ubicacion="Sala de arte")
        pin = self.mapa()[0]["eventos"][0]
        self.assertEqual(set(pin), {"id", "nombre", "categoria", "detalle_ubicacion", "fechas"})
        self.assertEqual(pin["categoria"]["color"], "#1FE425")
        self.assertEqual(pin["fechas"][0]["estado"], EN_VIVO)

    def test_RF032_RF033_mapa_excluye_oculto_y_suspendido(self):
        self.crear_evento(oculto=True)
        self.crear_evento(creador=self.otro)
        self.otro.is_active = False
        self.otro.save()
        self.assertEqual(self.mapa(), [])


class DetalleTests(BaseEventosTest):
    """INTERACTIVITY-2 · criterios 2 y 3, INTERACTIVITY-3, G-38"""

    def detalle(self, evento):
        return self.client.get(f"/api/eventos/{evento.pk}/")

    def test_INTERACTIVITY_2_c2_detalle_completo(self):
        evento = self.crear_evento(cupo=20, contacto="@club", enlace_externo="https://example.com", creador=self.otro)
        respuesta = self.detalle(evento)
        self.assertEqual(respuesta.status_code, 200)
        for campo in ["nombre", "categoria", "descripcion", "responsable", "ubicacion", "detalle_ubicacion",
                      "cupo", "imagen", "enlace_externo", "contacto", "fechas"]:
            self.assertIn(campo, respuesta.data)
        self.assertNotIn("oculto", respuesta.data)

    def test_INTERACTIVITY_2_c3_distingue_la_informacion_de_cada_fecha(self):
        evento = self.crear_evento((-50, -48), (-1, 1), (24, 26))
        fechas = self.detalle(evento).data["fechas"]
        self.assertEqual([f["estado"] for f in fechas], [FINALIZADA, EN_VIVO, PROXIMA])
        self.assertEqual(len({f["inicio"] for f in fechas}), 3)

    def test_INTERACTIVITY_3_c1_muestra_el_detalle_de_ubicacion(self):
        evento = self.crear_evento(detalle_ubicacion="Salón 201, piso 2")
        self.assertEqual(self.detalle(evento).data["detalle_ubicacion"], "Salón 201, piso 2")

    def test_INTERACTIVITY_3_c2_sin_detalle_no_se_inventa(self):
        self.assertEqual(self.detalle(self.crear_evento()).data["detalle_ubicacion"], "")

    def test_INTERACTIVITY_3_c3_muestra_la_ubicacion_actualizada(self):
        # G-30: la ubicación y su detalle son del evento; al editarlos, el detalle refleja el cambio.
        evento = self.crear_evento()
        nueva = Ubicacion.objects.create(nombre="Biblioteca")
        self.client.patch(f"/api/eventos/{evento.pk}/", {"ubicacion": nueva.pk, "detalle_ubicacion": "Sala 3"}, format="json")
        datos = self.detalle(evento).data
        self.assertEqual((datos["ubicacion"]["nombre"], datos["detalle_ubicacion"]), ("Biblioteca", "Sala 3"))

    def test_G38_no_vigente_oculto_o_de_suspendido_responde_404(self):
        terminado = self.crear_evento((-5, -3))
        oculto = self.crear_evento(oculto=True)
        de_suspendido = self.crear_evento(creador=self.otro)
        self.otro.is_active = False
        self.otro.save()
        for evento in [terminado, oculto, de_suspendido]:
            self.assertEqual(self.detalle(evento).status_code, 404)
        self.assertEqual(self.client.get("/api/eventos/99999/").status_code, 404)
