from django.core import mail
from django.core.exceptions import PermissionDenied
from rest_framework.test import APIClient

from cuentas.models import Usuario
from eventos.models import Fecha
from eventos.tests.base import CLAVE, BaseEventosTest
from moderacion.models import CasoReporte, RegistroModeracion, Reporte
from moderacion.normas import Norma


class BaseModeracionTest(BaseEventosTest):
    def setUp(self):
        super().setUp()
        self.creador.nombre = "Ana"
        self.creador.save()
        self.evento = self.crear_evento((24, 26), (48, 50))

    def feed(self):
        return [e["id"] for e in self.client.get("/api/eventos/").data]

    def post_admin(self, url, datos=None):
        self.como(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(url, datos or {}, format="json")


class ReporteTests(BaseModeracionTest):
    """DISPLAY-3"""

    def reportar(self, datos, evento=None):
        self.como(self.otro)
        return self.client.post(f"/api/eventos/{(evento or self.evento).pk}/reportes/", datos, format="json")

    def test_DISPLAY_3_c1_reporte_con_causa_asociado_al_usuario_y_al_evento(self):
        respuesta = self.reportar({"causa": Norma.SIN_SPAM})
        self.assertEqual(respuesta.status_code, 201)
        reporte = Reporte.objects.get()
        self.assertEqual((reporte.usuario, reporte.evento, reporte.causa), (self.otro, self.evento, Norma.SIN_SPAM))
        self.assertEqual(reporte.caso.estado, CasoReporte.PENDIENTE)

    def test_DISPLAY_3_c2_detalles_opcionales_incluidos(self):
        self.reportar({"causa": Norma.SIN_SPAM, "detalles": "Duplicado del evento de ayer"})
        self.assertEqual(Reporte.objects.get().detalles, "Duplicado del evento de ayer")

    def test_DISPLAY_3_c3_confirmacion_sin_seguimiento(self):
        respuesta = self.reportar({"causa": Norma.RESPETO})
        self.assertEqual(respuesta.json(), {"detail": "El reporte fue enviado y será revisado."})
        self.assertEqual(self.client.get("/api/admin/casos/").status_code, 403)  # quien reporta no ve el caso

    def test_DISPLAY_3_DoD_causa_obligatoria_y_de_la_lista_de_normas(self):
        for datos in [{}, {"causa": 11}, {"causa": "spam"}, {"detalles": "solo detalles"}]:
            self.assertEqual(self.reportar(datos).status_code, 400, datos)
        self.assertFalse(Reporte.objects.exists())

    def test_DISPLAY_3_DoD_solo_eventos_visibles_desde_su_detalle(self):
        terminado = self.crear_evento((-5, -3))
        self.assertEqual(self.reportar({"causa": Norma.AMBITO}, terminado).status_code, 404)
        self.assertEqual(APIClient().post(f"/api/eventos/{self.evento.pk}/reportes/", {"causa": 1}).status_code, 401)

    def test_G20_normas_disponibles(self):
        normas = self.client.get("/api/normas/").data
        self.assertEqual(len(normas), 10)
        self.assertEqual(normas[4], {"id": 5, "nombre": "Sin spam, duplicados ni publicidad ajena"})


class CasosTests(BaseModeracionTest):
    """ADMIN-2"""

    def reportar(self, usuario, causa=Norma.SIN_SPAM):
        self.como(usuario)
        self.client.post(f"/api/eventos/{self.evento.pk}/reportes/", {"causa": causa}, format="json")

    def patch_caso(self, caso, datos):
        self.como(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.patch(f"/api/admin/casos/{caso.pk}/", datos, format="json")

    def test_ADMIN_2_c1_varios_reportes_del_mismo_evento_en_un_caso(self):
        tercero = Usuario.objects.create_user("tercero@example.com", CLAVE)
        self.reportar(self.otro)
        self.reportar(tercero, Norma.INFORMACION_VERAZ)
        self.como(self.admin)
        casos = self.client.get("/api/admin/casos/").data
        self.assertEqual(len(casos), 1)
        self.assertEqual(casos[0]["evento"]["id"], self.evento.pk)
        self.assertEqual(len(casos[0]["reportes"]), 2)

    def test_ADMIN_2_c2_el_caso_pasa_por_sus_estados(self):
        self.reportar(self.otro)
        caso = CasoReporte.objects.get()
        self.assertEqual(self.patch_caso(caso, {"estado": "en_revision"}).data["estado"], "en_revision")
        self.como(self.admin)
        self.assertEqual(len(self.client.get("/api/admin/casos/?estado=en_revision").data), 1)
        self.assertEqual(self.patch_caso(caso, {"estado": "revisado", "decision_ocultar": False}).data["estado"], "revisado")

    def test_ADMIN_2_c3_revisado_decide_ocultar(self):
        self.reportar(self.otro)
        caso = CasoReporte.objects.get()
        respuesta = self.patch_caso(caso, {"estado": "revisado", "decision_ocultar": True, "norma": Norma.SIN_SPAM,
                                           "explicacion": "Duplicado"})
        self.assertEqual(respuesta.status_code, 200)
        self.evento.refresh_from_db()
        self.assertTrue(self.evento.oculto)
        registro = RegistroModeracion.objects.get()
        self.assertEqual(list(registro.reportes.all()), list(caso.reportes.all()))
        self.assertEqual(len(mail.outbox), 1)

    def test_ADMIN_2_c3_revisado_decide_no_ocultar(self):
        self.reportar(self.otro)
        self.patch_caso(CasoReporte.objects.get(), {"estado": "revisado", "decision_ocultar": False})
        self.como(self.creador)
        self.assertIn(self.evento.pk, self.feed())
        self.assertFalse(RegistroModeracion.objects.exists())

    def test_ADMIN_2_c3_decision_obligatoria_y_con_norma_si_se_oculta(self):
        self.reportar(self.otro)
        caso = CasoReporte.objects.get()
        for datos in [{"estado": "revisado"}, {"estado": "revisado", "decision_ocultar": True},
                      {"estado": "pendiente", "decision_ocultar": True}]:
            self.assertEqual(self.patch_caso(caso, datos).status_code, 400, datos)

    def test_ADMIN_2_DoD_acceso_restringido_al_administrador(self):
        self.reportar(self.otro)
        caso = CasoReporte.objects.get()
        self.como(self.creador)
        self.assertEqual(self.client.get("/api/admin/casos/").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/admin/casos/{caso.pk}/", {"estado": "en_revision"}).status_code, 403)


class ModeracionContenidoTests(BaseModeracionTest):
    """ADMIN-1"""

    def test_ADMIN_1_c1_ocultar_evento_lo_retira_del_mapa_y_el_feed(self):
        respuesta = self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        self.assertEqual(respuesta.status_code, 200)
        self.como(self.otro)
        self.assertNotIn(self.evento.pk, self.feed())
        self.assertEqual(self.client.get("/api/mapa/").data, [])

    def test_ADMIN_1_c1_ocultar_una_fecha_no_afecta_a_las_demas(self):
        primera, segunda = self.evento.fechas.all()
        self.post_admin(f"/api/admin/fechas/{primera.pk}/ocultar/", {"norma": Norma.INFORMACION_VERAZ})
        self.como(self.otro)
        fechas = self.client.get(f"/api/eventos/{self.evento.pk}/").data["fechas"]
        self.assertEqual([f["id"] for f in fechas], [segunda.pk])

    def test_ADMIN_1_c2_restaurar_vuelve_a_mostrarlo(self):
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        respuesta = self.post_admin(f"/api/admin/eventos/{self.evento.pk}/restaurar/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data["oculto"])
        self.assertIsNone(respuesta.data["norma_ocultamiento"])
        self.como(self.otro)
        self.assertIn(self.evento.pk, self.feed())
        self.assertEqual(
            list(RegistroModeracion.objects.order_by("pk").values_list("tipo_accion", flat=True)), ["ocultar", "restaurar"]
        )

    def test_ADMIN_1_c3_no_se_modera_contenido_finalizado(self):
        terminado = self.crear_evento((-5, -3))
        fecha_finalizada = self.crear_evento((-5, -3), (24, 26)).fechas.first()
        r1 = self.post_admin(f"/api/admin/eventos/{terminado.pk}/ocultar/", {"norma": Norma.AMBITO})
        r2 = self.post_admin(f"/api/admin/fechas/{fecha_finalizada.pk}/ocultar/", {"norma": Norma.AMBITO})
        self.assertEqual((r1.status_code, r1.json()["code"]), (409, "contenido_caducado"))
        self.assertEqual((r2.status_code, r2.json()["code"]), (409, "contenido_caducado"))

    def test_ADMIN_1_c4_creador_ve_marca_y_motivo_y_recibe_correo(self):
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.SIN_SPAM, "explicacion": "Duplicado"})
        self.como(self.creador)
        evento = self.client.get("/api/mis-eventos/").data[0]
        self.assertTrue(evento["oculto"])
        self.assertEqual((evento["norma_ocultamiento"], evento["explicacion_ocultamiento"]), (5, "Duplicado"))
        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, [self.creador.email])
        self.assertIn("Norma incumplida: 5. Sin spam, duplicados ni publicidad ajena.", correo.body)
        self.assertIn("Duplicado", correo.body)

    def test_ADMIN_1_c4_fecha_oculta_marcada_para_el_creador(self):
        fecha = self.evento.fechas.first()
        self.post_admin(f"/api/admin/fechas/{fecha.pk}/ocultar/", {"norma": Norma.PRIVACIDAD})
        self.como(self.creador)
        fechas = self.client.get("/api/mis-eventos/").data[0]["fechas"]
        self.assertEqual((fechas[0]["oculta"], fechas[0]["norma_ocultamiento"]), (True, 6))
        self.assertIn("la fecha del", mail.outbox[0].body)

    def test_ADMIN_1_DoD_motivo_obligatorio(self):
        self.assertEqual(self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {}).status_code, 400)

    def test_ADMIN_1_DoD_acceso_exclusivo_del_administrador(self):
        self.como(self.creador)
        for url in [f"/api/admin/eventos/{self.evento.pk}/ocultar/", f"/api/admin/eventos/{self.evento.pk}/restaurar/",
                    "/api/admin/eventos/"]:
            metodo = self.client.get if url.endswith("eventos/") else self.client.post
            self.assertEqual(metodo(url, {"norma": 1}).status_code, 403, url)

    def test_ADMIN_1_revisar_lista_eventos_ocultos(self):
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        visible = self.crear_evento()
        ocultos = [e["id"] for e in self.client.get("/api/admin/eventos/?oculto=true").data]
        self.assertEqual(ocultos, [self.evento.pk])
        self.assertIn(visible.pk, [e["id"] for e in self.client.get("/api/admin/eventos/").data])

    def test_G23_creador_no_actua_sobre_contenido_oculto(self):
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        self.como(self.creador)
        respuesta = self.client.post(f"/api/eventos/{self.evento.pk}/cancelar-todas/")
        self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (409, "contenido_oculto"))

    def test_G24_contenido_con_registro_no_se_elimina(self):
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/restaurar/")
        self.como(self.creador)
        respuesta = self.client.delete(f"/api/eventos/{self.evento.pk}/")
        self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (409, "pendiente_g24"))


class SuspensionTests(BaseModeracionTest):
    """ADMIN-3"""

    def suspender(self, usuario, datos=None):
        return self.post_admin(f"/api/admin/usuarios/{usuario.pk}/suspender/", datos or {"norma": Norma.CUENTA_PERSONAL})

    def test_ADMIN_3_c1_suspendida_no_inicia_sesion_ni_publica(self):
        tokens = APIClient().post("/api/auth/token/", {"email": self.creador.email, "password": CLAVE}).data
        self.assertEqual(self.suspender(self.creador).status_code, 200)
        login = APIClient().post("/api/auth/token/", {"email": self.creador.email, "password": CLAVE})
        self.assertEqual(login.json()["code"], "cuenta_suspendida")
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(cliente.post("/api/eventos/", self.datos_evento(), format="json").status_code, 401)

    def test_ADMIN_3_c2_sus_fechas_vigentes_se_ocultan(self):
        self.suspender(self.creador)
        self.como(self.otro)
        self.assertNotIn(self.evento.pk, self.feed())

    def test_ADMIN_3_c3_reactivar_restablece_acceso_y_fechas(self):
        self.suspender(self.creador)
        self.assertEqual(self.post_admin(f"/api/admin/usuarios/{self.creador.pk}/reactivar/").status_code, 200)
        login = APIClient().post("/api/auth/token/", {"email": self.creador.email, "password": CLAVE})
        self.assertEqual(login.status_code, 200)
        self.como(self.otro)
        self.assertIn(self.evento.pk, self.feed())

    def test_ADMIN_3_c3_lo_ocultado_antes_sigue_oculto_al_reactivar(self):
        # G-06 (T-4): la suspensión no toca los ocultamientos individuales.
        fecha = self.evento.fechas.first()
        self.post_admin(f"/api/admin/fechas/{fecha.pk}/ocultar/", {"norma": Norma.PRIVACIDAD})
        self.suspender(self.creador)
        self.post_admin(f"/api/admin/usuarios/{self.creador.pk}/reactivar/")
        self.assertTrue(Fecha.objects.get(pk=fecha.pk).oculta)

    def test_ADMIN_3_c4_correo_con_la_norma_incumplida(self):
        self.suspender(self.creador, {"norma": Norma.CUENTA_PERSONAL, "explicacion": "Suplantación"})
        correo = mail.outbox[-1]
        self.assertEqual(correo.to, [self.creador.email])
        self.assertIn("Norma incumplida: 10. Cuenta personal y reportes de buena fe.", correo.body)
        self.assertIn("Suplantación", correo.body)

    def test_ADMIN_3_DoD_exclusivo_del_administrador_y_registrado(self):
        self.como(self.otro)
        self.assertEqual(self.client.post(f"/api/admin/usuarios/{self.creador.pk}/suspender/", {"norma": 1}).status_code, 403)
        self.suspender(self.creador)
        self.post_admin(f"/api/admin/usuarios/{self.creador.pk}/reactivar/")
        acciones = list(RegistroModeracion.objects.order_by("pk").values_list("tipo_accion", "estado_anterior", "estado_posterior"))
        self.assertEqual(acciones, [("suspender", "activa", "suspendida"), ("reactivar", "suspendida", "activa")])

    def test_ADMIN_3_DoD_estados_no_validos(self):
        self.assertEqual(self.post_admin(f"/api/admin/usuarios/{self.creador.pk}/reactivar/").status_code, 409)
        self.suspender(self.creador)
        self.assertEqual(self.suspender(self.creador).status_code, 409)
        self.assertEqual(self.suspender(self.creador, {}).status_code, 409)  # estado antes que motivo

    def test_G28_no_se_suspende_a_un_administrador(self):
        otro_admin = Usuario.objects.create_user("admin2@example.com", CLAVE, es_administrador=True)
        for usuario in [otro_admin, self.admin]:
            respuesta = self.suspender(usuario)
            self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (409, "pendiente_g28"))


class AdministradoresYRegistroTests(BaseModeracionTest):
    """ADMIN-4"""

    def test_ADMIN_4_c2_asignar_y_revocar_el_rol(self):
        respuesta = self.post_admin(f"/api/admin/usuarios/{self.otro.pk}/asignar-admin/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data["es_administrador"])
        self.otro.refresh_from_db()
        self.como(self.otro)
        self.assertEqual(self.client.get("/api/admin/usuarios/").status_code, 200)  # ya accede al módulo
        respuesta = self.post_admin(f"/api/admin/usuarios/{self.otro.pk}/revocar-admin/")
        self.assertFalse(respuesta.data["es_administrador"])
        self.otro.refresh_from_db()
        self.como(self.otro)
        self.assertEqual(self.client.get("/api/admin/usuarios/").status_code, 403)

    def test_ADMIN_4_c2_solo_a_otros_usuarios_y_solo_administradores(self):
        respuesta = self.post_admin(f"/api/admin/usuarios/{self.admin.pk}/revocar-admin/")
        self.assertEqual((respuesta.status_code, respuesta.json()["code"]), (409, "rol_propio"))
        self.como(self.otro)
        self.assertEqual(self.client.post(f"/api/admin/usuarios/{self.otro.pk}/asignar-admin/").status_code, 403)

    def test_ADMIN_4_c3_registro_con_todos_sus_datos(self):
        self.como(self.otro)
        self.client.post(f"/api/eventos/{self.evento.pk}/reportes/", {"causa": Norma.SIN_SPAM}, format="json")
        caso = CasoReporte.objects.get()
        self.como(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f"/api/admin/casos/{caso.pk}/", {"estado": "revisado", "decision_ocultar": True,
                                                               "norma": Norma.SIN_SPAM, "explicacion": "Duplicado"}, format="json")
        registro = self.client.get("/api/admin/registro/").data[0]
        self.assertTrue(registro["fecha_hora"])
        self.assertEqual(registro["administrador"]["id"], self.admin.pk)
        self.assertEqual(registro["tipo_accion"], "ocultar")
        self.assertEqual((registro["evento"], registro["cuenta_afectada"]["id"]), (self.evento.pk, self.creador.pk))
        self.assertEqual((registro["norma"], registro["explicacion"]), (5, "Duplicado"))
        self.assertEqual(registro["reportes"], [Reporte.objects.get().pk])
        self.assertEqual((registro["estado_anterior"], registro["estado_posterior"]), ("visible", "oculto"))

    def test_ADMIN_4_c4_registro_no_se_edita_ni_elimina(self):
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        registro = RegistroModeracion.objects.get()
        url = f"/api/admin/registro/{registro.pk}/"
        self.assertEqual(self.client.get(url).status_code, 200)
        for metodo in [self.client.put, self.client.patch, self.client.delete]:
            self.assertEqual(metodo(url, {"explicacion": "x"}, format="json").status_code, 405)
        registro.explicacion = "cambiada"
        with self.assertRaises(PermissionDenied):
            registro.save()
        with self.assertRaises(PermissionDenied):
            registro.delete()
        with self.assertRaises(PermissionDenied):
            RegistroModeracion.objects.all().delete()
        with self.assertRaises(PermissionDenied):
            RegistroModeracion.objects.update(explicacion="x")

    def test_ADMIN_4_c3_consultable_por_cualquier_administrador_y_nadie_mas(self):
        segundo = Usuario.objects.create_user("admin2@example.com", CLAVE, es_administrador=True)
        self.post_admin(f"/api/admin/eventos/{self.evento.pk}/ocultar/", {"norma": Norma.RESPETO})
        self.como(segundo)
        self.assertEqual(len(self.client.get("/api/admin/registro/").data), 1)
        self.como(self.creador)
        self.assertEqual(self.client.get("/api/admin/registro/").status_code, 403)
