import io
import os
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils.dateparse import parse_datetime
from PIL import Image
from rest_framework.test import APIClient

from eventos.models import CANCELADA, EN_VIVO, FINALIZADA, PROXIMA, Categoria, Evento, Fecha, Ubicacion
from eventos.tests.base import BaseEventosTest, en


def imagen(formato="PNG", tamano=(10, 10), ruido=False, nombre="foto.png"):
    contenido = os.urandom(tamano[0] * tamano[1] * 3) if ruido else None
    img = Image.frombytes("RGB", tamano, contenido) if ruido else Image.new("RGB", tamano, "red")
    buffer = io.BytesIO()
    img.save(buffer, formato)
    return SimpleUploadedFile(nombre, buffer.getvalue())


class CreacionTests(BaseEventosTest):
    """PUBLICATION-1"""

    def test_PUBLICATION_1_c1_publica_con_datos_obligatorios_y_una_fecha(self):
        respuesta = self.client.post("/api/eventos/", self.datos_evento(), format="json")
        self.assertEqual(respuesta.status_code, 201)
        evento = Evento.objects.get()
        self.assertEqual(evento.creador, self.creador)
        self.assertEqual(respuesta.data["fechas"][0]["estado"], PROXIMA)

    def test_PUBLICATION_1_c1_faltan_datos_obligatorios(self):
        for campo in ["nombre", "categoria", "descripcion", "responsable", "ubicacion", "fechas"]:
            datos = self.datos_evento()
            del datos[campo]
            respuesta = self.client.post("/api/eventos/", datos, format="json")
            self.assertEqual(respuesta.status_code, 400, campo)
            self.assertIn(campo, respuesta.data)
        respuesta = self.client.post("/api/eventos/", self.datos_evento(fechas=[]), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(Evento.objects.exists())

    def test_PUBLICATION_1_c1_requiere_sesion(self):
        anonimo = APIClient()
        self.assertEqual(anonimo.post("/api/eventos/", self.datos_evento(), format="json").status_code, 401)

    def test_PUBLICATION_1_c2_cada_fecha_con_su_propio_horario(self):
        fechas = [
            {"inicio": en(24).isoformat(), "fin": en(26).isoformat()},
            {"inicio": en(48).isoformat(), "fin": en(51).isoformat()},
        ]
        respuesta = self.client.post("/api/eventos/", self.datos_evento(fechas=fechas), format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(Fecha.objects.count(), 2)
        duraciones = sorted((f.fin - f.inicio).seconds // 3600 for f in Fecha.objects.all())
        self.assertEqual(duraciones, [2, 3])

    def test_PUBLICATION_1_c3_ubicacion_del_catalogo(self):
        respuesta = self.client.post("/api/eventos/", self.datos_evento(ubicacion=9999), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("ubicacion", respuesta.data)

    def test_PUBLICATION_1_c4_datos_opcionales_quedan_asociados(self):
        datos = self.datos_evento(
            cupo=30, enlace_externo="https://example.com/taller", contacto="@ceramica", detalle_ubicacion="Salón 201"
        )
        respuesta = self.client.post("/api/eventos/", datos, format="json")
        self.assertEqual(respuesta.status_code, 201)
        for campo in ["cupo", "enlace_externo", "contacto", "detalle_ubicacion"]:
            self.assertEqual(respuesta.data[campo], datos[campo])

    def test_PUBLICATION_1_c4_valida_opcionales(self):
        for cambios in [{"cupo": 0}, {"enlace_externo": "ftp://example.com"}, {"enlace_externo": "no-es-url"}]:
            respuesta = self.client.post("/api/eventos/", self.datos_evento(**cambios), format="json")
            self.assertEqual(respuesta.status_code, 400, cambios)

    def test_PUBLICATION_1_DoD_categoria_inactiva_rechazada(self):
        self.categoria.activa = False
        self.categoria.save()
        respuesta = self.client.post("/api/eventos/", self.datos_evento(), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("categoria", respuesta.data)

    def test_PUBLICATION_1_DoD_horarios_invalidos(self):
        casos = [
            [{"inicio": en(26).isoformat(), "fin": en(24).isoformat()}],  # fin antes del inicio
            [{"inicio": en(-2).isoformat(), "fin": en(2).isoformat()}],  # en el pasado
            [  # solapadas
                {"inicio": en(24).isoformat(), "fin": en(27).isoformat()},
                {"inicio": en(26).isoformat(), "fin": en(28).isoformat()},
            ],
        ]
        for fechas in casos:
            respuesta = self.client.post("/api/eventos/", self.datos_evento(fechas=fechas), format="json")
            self.assertEqual(respuesta.status_code, 400, fechas)
        self.assertFalse(Evento.objects.exists())

    def test_PUBLICATION_1_DoD_fecha_de_varios_dias_y_fechas_contiguas(self):
        fechas = [
            {"inicio": en(24).isoformat(), "fin": en(54).isoformat()},
            {"inicio": en(54).isoformat(), "fin": en(56).isoformat()},
        ]
        self.assertEqual(self.client.post("/api/eventos/", self.datos_evento(fechas=fechas), format="json").status_code, 201)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ImagenTests(BaseEventosTest):
    """PUBLICATION-1 · criterio 4 (imagen, G-07)."""

    def setUp(self):
        super().setUp()
        self.evento = self.crear_evento()
        self.url = f"/api/eventos/{self.evento.pk}/imagen/"

    def test_PUBLICATION_1_c4_sube_imagen_png_o_jpg(self):
        for archivo in [imagen("PNG"), imagen("JPEG", nombre="foto.jpg")]:
            respuesta = self.client.put(self.url, {"imagen": archivo}, format="multipart")
            self.assertEqual(respuesta.status_code, 200)
            self.assertTrue(respuesta.json()["imagen"].startswith("http://testserver/media/eventos/"))

    def test_PUBLICATION_1_c4_rechaza_formato_no_permitido(self):
        for archivo in [imagen("GIF", nombre="foto.gif"), imagen("GIF", nombre="falsa.png"),
                        SimpleUploadedFile("texto.png", b"no es una imagen")]:
            respuesta = self.client.put(self.url, {"imagen": archivo}, format="multipart")
            self.assertEqual(respuesta.status_code, 400, archivo.name)

    def test_PUBLICATION_1_c4_rechaza_imagen_de_mas_de_5MB(self):
        grande = imagen("PNG", tamano=(1400, 1400), ruido=True)
        self.assertGreater(grande.size, 5 * 1024 * 1024)
        self.assertEqual(self.client.put(self.url, {"imagen": grande}, format="multipart").status_code, 400)

    def test_PUBLICATION_1_c4_solo_el_creador_cambia_la_imagen(self):
        self.como(self.otro)
        self.assertEqual(self.client.put(self.url, {"imagen": imagen()}, format="multipart").status_code, 403)


class MisEventosTests(BaseEventosTest):
    """PUBLICATION-2"""

    def mis_eventos(self, vista="vigentes"):
        return self.client.get(f"/api/mis-eventos/?vista={vista}").data

    def test_PUBLICATION_2_c1_estado_de_cada_fecha(self):
        evento = self.crear_evento((-50, -48), (-1, 1), (24, 26), (48, 50))
        Fecha.objects.filter(evento=evento, inicio__gt=en(40)).update(cancelada=True)
        estados = [f["estado"] for f in self.mis_eventos()[0]["fechas"]]
        self.assertEqual(estados, [FINALIZADA, EN_VIVO, PROXIMA, CANCELADA])

    def test_PUBLICATION_2_c3_sin_fechas_vigentes_pasa_al_historial(self):
        vigente = self.crear_evento((24, 26))
        terminado = self.crear_evento((-5, -3))
        cancelado = self.crear_evento((24, 26))
        cancelado.fechas.update(cancelada=True)
        self.assertEqual([e["id"] for e in self.mis_eventos("vigentes")], [vigente.pk])
        self.assertEqual([e["id"] for e in self.mis_eventos("historial")], [terminado.pk, cancelado.pk])

    def test_PUBLICATION_2_c4_oculto_se_muestra_marcado(self):
        evento = self.crear_evento(oculto=True)
        self.assertTrue(self.mis_eventos()[0]["oculto"])
        evento.fechas.update(oculta=True)
        self.assertTrue(self.mis_eventos()[0]["fechas"][0]["oculta"])

    def test_PUBLICATION_2_solo_eventos_propios(self):
        self.crear_evento(creador=self.otro)
        self.assertEqual(self.mis_eventos(), [])

    def test_PUBLICATION_2_vista_invalida(self):
        self.assertEqual(self.client.get("/api/mis-eventos/?vista=otra").status_code, 400)


class EdicionTests(BaseEventosTest):
    """PUBLICATION-3 y G-30 (edición del evento y fechas nuevas)."""

    def test_PUBLICATION_3_c1_creador_edita_fecha_proxima(self):
        fecha = self.crear_evento((24, 26)).fechas.get()
        inicio, fin = en(30), en(33)
        respuesta = self.client.patch(f"/api/fechas/{fecha.pk}/", {"inicio": inicio.isoformat(), "fin": fin.isoformat()}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        fecha.refresh_from_db()
        self.assertEqual((fecha.inicio, fecha.fin), (inicio, fin))

    def test_PUBLICATION_3_c2_las_demas_fechas_no_cambian(self):
        evento = self.crear_evento((24, 26), (48, 50))
        primera, segunda = evento.fechas.all()
        antes = (segunda.inicio, segunda.fin)
        self.client.patch(f"/api/fechas/{primera.pk}/", {"fin": en(27).isoformat()}, format="json")
        segunda.refresh_from_db()
        self.assertEqual((segunda.inicio, segunda.fin), antes)

    def test_PUBLICATION_3_c3_cambio_visible_en_la_siguiente_consulta(self):
        # El feed y el mapa llegan en la capa 4; aquí se comprueba con "Mis eventos".
        fecha = self.crear_evento((24, 26)).fechas.get()
        nuevo_fin = en(29)
        self.client.patch(f"/api/fechas/{fecha.pk}/", {"fin": nuevo_fin.isoformat()}, format="json")
        fin = self.client.get("/api/mis-eventos/").data[0]["fechas"][0]["fin"]
        self.assertEqual(parse_datetime(fin), nuevo_fin)

    def test_PUBLICATION_3_c4_no_edita_fechas_finalizadas_canceladas_o_en_vivo(self):
        evento = self.crear_evento((-5, -3), (-1, 1), (24, 26))
        Fecha.objects.filter(evento=evento, inicio__gt=en(0)).update(cancelada=True)
        for fecha in evento.fechas.all():
            respuesta = self.client.patch(f"/api/fechas/{fecha.pk}/", {"fin": en(100).isoformat()}, format="json")
            self.assertEqual(respuesta.status_code, 409, fecha.estado())

    def test_PUBLICATION_3_DoD_edicion_restringida_al_creador(self):
        fecha = self.crear_evento().fechas.get()
        for usuario in [self.otro, self.admin]:
            self.como(usuario)
            self.assertEqual(self.client.patch(f"/api/fechas/{fecha.pk}/", {}, format="json").status_code, 403)

    def test_PUBLICATION_3_DoD_horario_editado_valido(self):
        evento = self.crear_evento((24, 26), (48, 50))
        primera = evento.fechas.first()
        for datos in [{"inicio": en(-1).isoformat()}, {"fin": en(49).isoformat()}, {"fin": en(23).isoformat()}]:
            self.assertEqual(self.client.patch(f"/api/fechas/{primera.pk}/", datos, format="json").status_code, 400)

    def test_G30_creador_edita_datos_y_ubicacion_del_evento(self):
        evento = self.crear_evento()
        nueva = Ubicacion.objects.create(nombre="Otro edificio")
        datos = {"nombre": "Nuevo nombre", "ubicacion": nueva.pk, "categoria": Categoria.objects.get(nombre="Ventas").pk}
        respuesta = self.client.patch(f"/api/eventos/{evento.pk}/", datos, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["ubicacion"]["nombre"], "Otro edificio")
        self.assertEqual(respuesta.data["categoria"]["nombre"], "Ventas")

    def test_G30_evento_en_historial_no_se_edita(self):
        evento = self.crear_evento((-5, -3))
        self.assertEqual(self.client.patch(f"/api/eventos/{evento.pk}/", {"nombre": "x"}, format="json").status_code, 409)

    def test_G30_solo_el_creador_edita_el_evento(self):
        evento = self.crear_evento()
        self.como(self.otro)
        self.assertEqual(self.client.patch(f"/api/eventos/{evento.pk}/", {"nombre": "x"}, format="json").status_code, 403)

    def test_G30_anade_fecha_a_evento_publicado(self):
        evento = self.crear_evento((24, 26))
        url = f"/api/eventos/{evento.pk}/fechas/"
        nueva = {"inicio": en(48).isoformat(), "fin": en(50).isoformat()}
        self.assertEqual(self.client.post(url, nueva, format="json").status_code, 201)
        self.assertEqual(evento.fechas.count(), 2)
        solapada = {"inicio": en(25).isoformat(), "fin": en(27).isoformat()}
        self.assertEqual(self.client.post(url, solapada, format="json").status_code, 400)

    def test_G31_se_puede_reprogramar_en_el_horario_de_una_fecha_cancelada(self):
        evento = self.crear_evento((24, 26), (48, 50))
        cancelada, otra = evento.fechas.all()
        cancelada.cancelada = True
        cancelada.save()
        en_su_lugar = {"inicio": en(24).isoformat(), "fin": en(26).isoformat()}
        self.assertEqual(self.client.post(f"/api/eventos/{evento.pk}/fechas/", en_su_lugar, format="json").status_code, 201)
        movida = {"inicio": en(25).isoformat(), "fin": en(27).isoformat()}
        self.assertEqual(self.client.patch(f"/api/fechas/{otra.pk}/", movida, format="json").status_code, 400)  # choca con la nueva

    def test_G30_no_anade_fechas_a_un_evento_en_historial(self):
        evento = self.crear_evento((-5, -3))
        nueva = {"inicio": en(48).isoformat(), "fin": en(50).isoformat()}
        self.assertEqual(self.client.post(f"/api/eventos/{evento.pk}/fechas/", nueva, format="json").status_code, 409)


class CancelacionTests(BaseEventosTest):
    """PUBLICATION-4 y PUBLICATION-5"""

    def cancelar(self, fecha):
        return self.client.post(f"/api/fechas/{fecha.pk}/cancelar/")

    def test_PUBLICATION_4_c1_cancela_fecha_proxima_o_en_vivo(self):
        evento = self.crear_evento((-1, 1), (24, 26))
        for fecha in evento.fechas.all():
            self.assertEqual(self.cancelar(fecha).status_code, 200)
            fecha.refresh_from_db()
            self.assertEqual(fecha.estado(), CANCELADA)

    def test_PUBLICATION_4_c2_las_demas_fechas_no_cambian(self):
        evento = self.crear_evento((24, 26), (48, 50))
        primera, segunda = evento.fechas.all()
        self.cancelar(primera)
        segunda.refresh_from_db()
        self.assertEqual(segunda.estado(), PROXIMA)

    def test_PUBLICATION_4_c3_fecha_cancelada_visible_mientras_el_evento_sigue_vigente(self):
        # G-32: la cancelada se muestra como tal dentro del evento mientras haya otras fechas vigentes.
        evento = self.crear_evento((24, 26), (48, 50))
        self.cancelar(evento.fechas.first())
        vigentes = self.client.get("/api/mis-eventos/").data
        self.assertEqual([f["estado"] for f in vigentes[0]["fechas"]], [CANCELADA, PROXIMA])

    def test_PUBLICATION_4_c3_cancelar_la_unica_fecha_vigente_retira_el_evento(self):
        # G-32: sin fechas no canceladas próximas o en vivo, el evento pasa al historial de inmediato.
        evento = self.crear_evento((-5, -3), (24, 26))
        self.cancelar(evento.fechas.last())
        self.assertFalse(evento.es_vigente())
        self.assertEqual(self.client.get("/api/mis-eventos/?vista=historial").data[0]["id"], evento.pk)

    def test_PUBLICATION_4_c4_fecha_finalizada_o_cancelada_solo_consulta(self):
        evento = self.crear_evento((-5, -3), (24, 26))
        finalizada, cancelada = evento.fechas.all()
        cancelada.cancelada = True
        cancelada.save()
        self.assertEqual(self.cancelar(finalizada).status_code, 409)
        self.assertEqual(self.cancelar(cancelada).status_code, 409)

    def test_PUBLICATION_4_DoD_cancelacion_restringida_al_creador(self):
        fecha = self.crear_evento().fechas.get()
        self.como(self.otro)
        self.assertEqual(self.cancelar(fecha).status_code, 403)

    def test_PUBLICATION_5_c1_cancela_todas_las_fechas_proximas_o_en_vivo(self):
        evento = self.crear_evento((-1, 1), (24, 26), (48, 50))
        self.assertEqual(self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/").status_code, 200)
        self.assertTrue(all(f.cancelada for f in evento.fechas.all()))

    def test_PUBLICATION_5_c2_fechas_finalizadas_sin_cambios(self):
        evento = self.crear_evento((-5, -3), (24, 26))
        self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/")
        estados = [f.estado() for f in evento.fechas.all()]
        self.assertEqual(estados, [FINALIZADA, CANCELADA])

    def test_PUBLICATION_5_c3_evento_pasa_al_historial(self):
        evento = self.crear_evento((24, 26), (48, 50))
        self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/")
        self.assertEqual(self.client.get("/api/mis-eventos/").data, [])
        historial = self.client.get("/api/mis-eventos/?vista=historial").data
        self.assertEqual([f["estado"] for f in historial[0]["fechas"]], [CANCELADA, CANCELADA])

    def test_PUBLICATION_5_DoD_sin_fechas_vigentes_no_aplica(self):
        evento = self.crear_evento((-5, -3))
        self.assertEqual(self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/").status_code, 409)

    def test_PUBLICATION_5_DoD_restringida_al_creador(self):
        evento = self.crear_evento()
        self.como(self.admin)
        self.assertEqual(self.client.post(f"/api/eventos/{evento.pk}/cancelar-todas/").status_code, 403)


class FinalizacionExtensionTests(BaseEventosTest):
    """PUBLICATION-6 y PUBLICATION-7"""

    def test_PUBLICATION_6_c1_finaliza_fecha_en_vivo(self):
        fecha = self.crear_evento((-1, 2)).fechas.get()
        self.assertEqual(self.client.post(f"/api/fechas/{fecha.pk}/finalizar/").status_code, 200)
        fecha.refresh_from_db()
        self.assertIsNotNone(fecha.finalizada_en)

    def test_PUBLICATION_6_c2_no_se_finaliza_dos_veces(self):
        fecha = self.crear_evento((-1, 2)).fechas.get()
        self.client.post(f"/api/fechas/{fecha.pk}/finalizar/")
        self.assertEqual(self.client.post(f"/api/fechas/{fecha.pk}/finalizar/").status_code, 409)

    def test_PUBLICATION_6_c3_deja_de_considerarse_en_vivo(self):
        evento = self.crear_evento((-1, 2))
        self.client.post(f"/api/fechas/{evento.fechas.get().pk}/finalizar/")
        self.assertEqual(self.client.get("/api/mis-eventos/?vista=historial").data[0]["fechas"][0]["estado"], FINALIZADA)

    def test_PUBLICATION_6_DoD_solo_fechas_en_vivo_y_solo_el_creador(self):
        evento = self.crear_evento((-1, 2), (24, 26))
        en_vivo, proxima = evento.fechas.all()
        self.assertEqual(self.client.post(f"/api/fechas/{proxima.pk}/finalizar/").status_code, 409)
        self.como(self.otro)
        self.assertEqual(self.client.post(f"/api/fechas/{en_vivo.pk}/finalizar/").status_code, 403)

    def test_PUBLICATION_7_c1_extiende_fecha_en_vivo(self):
        fecha = self.crear_evento((-1, 1)).fechas.get()
        respuesta = self.client.post(f"/api/fechas/{fecha.pk}/extender/", {"fin": en(3).isoformat()}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        fecha.refresh_from_db()
        self.assertGreater(fecha.fin, en(2))

    def test_PUBLICATION_7_c2_extender_solo_en_vivo(self):
        evento = self.crear_evento((-5, -3), (24, 26))
        for fecha in evento.fechas.all():
            respuesta = self.client.post(f"/api/fechas/{fecha.pk}/extender/", {"fin": en(30).isoformat()}, format="json")
            self.assertEqual(respuesta.status_code, 409)

    def test_PUBLICATION_7_c3_continua_en_vivo_hasta_el_nuevo_fin(self):
        fecha = self.crear_evento((-1, 1)).fechas.get()
        fin_original = fecha.fin
        self.client.post(f"/api/fechas/{fecha.pk}/extender/", {"fin": en(3).isoformat()}, format="json")
        fecha.refresh_from_db()
        self.assertEqual(fecha.estado(fin_original + (en(1) - en(0))), EN_VIVO)

    def test_PUBLICATION_7_DoD_nuevo_fin_valido(self):
        evento = self.crear_evento((-1, 1), (3, 5))
        fecha = evento.fechas.first()
        for fin in [en(0.5), en(4)]:  # antes del fin actual; solapa la siguiente fecha
            respuesta = self.client.post(f"/api/fechas/{fecha.pk}/extender/", {"fin": fin.isoformat()}, format="json")
            self.assertEqual(respuesta.status_code, 400)
        self.como(self.otro)
        self.assertEqual(self.client.post(f"/api/fechas/{fecha.pk}/extender/", {"fin": en(2).isoformat()}, format="json").status_code, 403)


class EliminacionTests(BaseEventosTest):
    """PUBLICATION-8 (eliminación por el creador; la del administrador va con la moderación, capa 5)."""

    def test_PUBLICATION_8_c1_elimina_fecha_proxima(self):
        evento = self.crear_evento((24, 26), (48, 50))
        fecha = evento.fechas.first()
        self.assertEqual(self.client.delete(f"/api/fechas/{fecha.pk}/").status_code, 204)
        self.assertFalse(Fecha.objects.filter(pk=fecha.pk).exists())
        self.assertTrue(Fecha.con_eliminadas.filter(pk=fecha.pk, eliminado=True).exists())  # borrado lógico (G-24)
        self.assertEqual(evento.fechas.count(), 1)

    def test_PUBLICATION_8_c2_elimina_evento_completo_con_sus_fechas_proximas(self):
        evento = self.crear_evento((24, 26), (48, 50))
        self.assertEqual(self.client.delete(f"/api/eventos/{evento.pk}/").status_code, 204)
        self.assertFalse(Evento.objects.exists())
        self.assertFalse(Fecha.objects.exists())
        self.assertTrue(Evento.con_eliminados.filter(pk=evento.pk, eliminado=True).exists())  # borrado lógico (G-24)
        self.assertEqual(Fecha.con_eliminadas.filter(evento=evento, eliminado=True).count(), 2)

    def test_PUBLICATION_8_c3_fecha_finalizada_no_se_elimina(self):
        evento = self.crear_evento((-5, -3), (24, 26))
        finalizada = evento.fechas.first()
        self.assertEqual(self.client.delete(f"/api/fechas/{finalizada.pk}/").status_code, 409)

    def test_PUBLICATION_8_DoD_solo_el_creador(self):
        evento = self.crear_evento((24, 26), (48, 50))
        self.como(self.otro)
        self.assertEqual(self.client.delete(f"/api/fechas/{evento.fechas.first().pk}/").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/eventos/{evento.pk}/").status_code, 403)

    #def test_PUBLICATION_8_casos_pendientes_de_G24_se_rechazan(self):
    #    unica = self.crear_evento((24, 26))
    #    respuesta = self.client.delete(f"/api/fechas/{unica.fechas.get().pk}/")
    #    self.assertEqual(respuesta.status_code, 409)
    #    self.assertEqual(respuesta.json()["code"], "pendiente_g24")
    #    con_fecha_en_vivo = self.crear_evento((-1, 1), (24, 26))
    #    self.assertEqual(self.client.delete(f"/api/eventos/{con_fecha_en_vivo.pk}/").status_code, 409)
    
    def test_PUBLICATION_8_la_unica_fecha_no_se_elimina_sola(self):
            unica = self.crear_evento((24, 26))
            respuesta = self.client.delete(f"/api/fechas/{unica.fechas.get().pk}/")
            self.assertEqual(respuesta.status_code, 409)
            self.assertEqual(respuesta.json()["code"], "unica_fecha")
    
    def test_PUBLICATION_8_c2_evento_con_otras_fechas_solo_pierde_las_proximas(self):
            evento = self.crear_evento((-5, -3), (-1, 1), (24, 26), (48, 50))
            finalizada, en_vivo = evento.fechas.all()[0], evento.fechas.all()[1]
            self.assertEqual(self.client.delete(f"/api/eventos/{evento.pk}/").status_code, 204)
            self.assertTrue(Evento.objects.filter(pk=evento.pk).exists())
            self.assertEqual(sorted(evento.fechas.values_list("pk", flat=True)), sorted([finalizada.pk, en_vivo.pk]))
    
    def test_PUBLICATION_8_c2_evento_sin_fechas_proximas_no_tiene_nada_que_eliminar(self):
            evento = self.crear_evento((-5, -3), (-1, 1))
            respuesta = self.client.delete(f"/api/eventos/{evento.pk}/")
            self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (409, "sin_fechas_proximas"))
    
    def test_PUBLICATION_8_lo_eliminado_desaparece_de_toda_la_plataforma(self):
            evento = self.crear_evento((24, 26))
            otro = self.crear_evento((48, 50), (72, 74))
            self.client.delete(f"/api/eventos/{evento.pk}/")
            self.client.delete(f"/api/fechas/{otro.fechas.first().pk}/")
            self.assertEqual(self.client.get(f"/api/eventos/{evento.pk}/").status_code, 404)
            self.assertEqual([e["id"] for e in self.client.get("/api/eventos/").data], [otro.pk])
            self.assertEqual([e["id"] for e in self.client.get("/api/mis-eventos/").data], [otro.pk])
            self.assertEqual(len(self.client.get("/api/mis-eventos/").data[0]["fechas"]), 1)
            self.assertEqual(self.client.delete(f"/api/eventos/{evento.pk}/").status_code, 404)
    
    def test_PUBLICATION_8_el_creador_no_elimina_contenido_oculto(self):
            evento = self.crear_evento((24, 26), (48, 50), oculto=True)
            respuesta = self.client.delete(f"/api/eventos/{evento.pk}/")
            self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (409, "contenido_oculto"))
