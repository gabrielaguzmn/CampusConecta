import re
from datetime import datetime, timedelta
from unittest import mock

from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from cuentas.models import Usuario

CLAVE = "clave-segura-123"


@override_settings(FRONTEND_URL_RECUPERACION="https://frontend.test/recuperar")
class AccesoTests(APITestCase):
    def iniciar_sesion(self, email, password=CLAVE):
        return self.client.post("/api/auth/token/", {"email": email, "password": password})

    # --- Criterio 1: registro con cualquier dominio, sin confirmación por enlace ---

    def test_ACCESS_1_c1_registro_con_cualquier_dominio_queda_disponible(self):
        respuesta = self.client.post("/api/auth/registro/", {"nombre": "Alguien", "email": "alguien@dominio-cualquiera.co", "password": CLAVE})
        self.assertEqual(respuesta.status_code, 201)
        self.assertNotIn("password", respuesta.data)
        self.assertEqual(len(mail.outbox), 0)  # no hay correo de confirmación
        self.assertEqual(self.iniciar_sesion("alguien@dominio-cualquiera.co").status_code, 200)

    def test_ACCESS_1_c1_nombre_obligatorio(self):
        # G-08: el nombre es obligatorio en el registro.
        for nombre in [None, ""]:
            datos = {"email": "sin-nombre@example.com", "password": CLAVE}
            if nombre is not None:
                datos["nombre"] = nombre
            respuesta = self.client.post("/api/auth/registro/", datos)
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn("nombre", respuesta.data)

    def test_ACCESS_1_c1_correo_repetido_se_rechaza(self):
        Usuario.objects.create_user("repetido@example.com", CLAVE)
        respuesta = self.client.post("/api/auth/registro/", {"nombre": "Otra", "email": "REPETIDO@example.com", "password": CLAVE})
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.json()["codes"]["email"], ["email_en_uso"])

    def test_ACCESS_1_c1_contrasena_debil_se_rechaza(self):
        # G-35: validadores estándar de Django.
        respuesta = self.client.post("/api/auth/registro/", {"nombre": "Débil", "email": "debil@example.com", "password": "123"})
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("password", respuesta.data)

    # --- Criterio 2: inicio de sesión y acceso a las vistas ---

    def test_ACCESS_1_c2_credenciales_validas_dan_acceso(self):
        Usuario.objects.create_user("persona@example.com", CLAVE, nombre="Persona")
        respuesta = self.iniciar_sesion("persona@example.com")
        self.assertEqual(respuesta.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
        yo = self.client.get("/api/auth/yo/")
        self.assertEqual(yo.status_code, 200)
        self.assertEqual(yo.data["email"], "persona@example.com")
        self.assertEqual(yo.data["nombre"], "Persona")
        self.assertFalse(yo.data["es_administrador"])

    def test_ACCESS_1_c2_credenciales_invalidas_se_rechazan(self):
        Usuario.objects.create_user("persona@example.com", CLAVE)
        respuesta = self.iniciar_sesion("persona@example.com", "otra-clave-999")
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(respuesta.json(), {"detail": "Correo o contraseña incorrectos.", "code": "no_active_account"})

    def test_ACCESS_1_DoD_errores_de_sesion_en_espanol(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer token-falso")
        self.assertEqual(
            self.client.get("/api/auth/yo/").json(),
            {"detail": "La sesión no es válida o ha caducado. Inicia sesión de nuevo.", "code": "token_not_valid"},
        )
        self.client.credentials()
        refresco = self.client.post("/api/auth/token/refresh/", {"refresh": "token-falso"}).json()
        self.assertEqual(refresco["code"], "token_not_valid")
        self.assertEqual(refresco["detail"], "La sesión no es válida o ha caducado. Inicia sesión de nuevo.")

    def test_ACCESS_1_DoD_sin_sesion_no_hay_acceso(self):
        self.assertEqual(self.client.get("/api/auth/yo/").status_code, 401)

    # --- Criterio 3: recuperación por correo (G-17) ---

    def enlace_del_correo(self):
        return dict(re.findall(r"[?&](uid|token)=([^&\s]+)", mail.outbox[-1].body))

    def test_ACCESS_1_c3_solicitud_envia_enlace_por_correo(self):
        Usuario.objects.create_user("olvido@example.com", CLAVE, nombre="Olvido")
        respuesta = self.client.post("/api/auth/recuperacion/", {"email": "olvido@example.com"})
        self.assertEqual(respuesta.status_code, 204)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["olvido@example.com"])
        self.assertIn("Hola, Olvido:", mail.outbox[0].body)
        self.assertIn("https://frontend.test/recuperar?uid=", mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].subject, "Recupera tu contraseña de CampusConecta")

    def test_ACCESS_1_c3_correo_inexistente_informa_error_sin_enviar(self):
        respuesta = self.client.post("/api/auth/recuperacion/", {"email": "nadie@example.com"})
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.json()["email"], ["La cuenta no está registrada."])
        self.assertEqual(respuesta.json()["codes"]["email"], "correo_no_registrado")
        self.assertEqual(len(mail.outbox), 0)

    def test_ACCESS_1_c3_cuenta_suspendida_no_puede_recuperar_contrasena(self):
        Usuario.objects.create_user("suspendida@example.com", CLAVE, nombre="Suspendida", is_active=False)
        respuesta = self.client.post("/api/auth/recuperacion/", {"email": "suspendida@example.com"})
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(
            respuesta.json()["email"],
            ["La cuenta está suspendida. No puedes recuperar la contraseña mientras esté suspendida."],
        )
        self.assertEqual(respuesta.json()["codes"]["email"], "cuenta_suspendida")
        self.assertEqual(len(mail.outbox), 0)

    def test_ACCESS_1_c3_enlace_permite_cambiar_la_contrasena_una_sola_vez(self):
        Usuario.objects.create_user("olvido@example.com", CLAVE)
        self.client.post("/api/auth/recuperacion/", {"email": "olvido@example.com"})
        datos = {**self.enlace_del_correo(), "password": "nueva-clave-456"}
        self.assertEqual(self.client.post("/api/auth/recuperacion/confirmar/", datos).status_code, 204)
        self.assertEqual(self.iniciar_sesion("olvido@example.com", "nueva-clave-456").status_code, 200)
        reutilizado = self.client.post("/api/auth/recuperacion/confirmar/", {**datos, "password": "otra-clave-789"})
        self.assertEqual(reutilizado.status_code, 400)

    def test_ACCESS_1_c3_enlace_caduca_despues_de_una_hora(self):
        Usuario.objects.create_user("olvido@example.com", CLAVE)
        self.client.post("/api/auth/recuperacion/", {"email": "olvido@example.com"})
        datos = {**self.enlace_del_correo(), "password": "nueva-clave-456"}
        despues = datetime.now() + timedelta(hours=1, minutes=1)
        with mock.patch("django.contrib.auth.tokens.PasswordResetTokenGenerator._now", return_value=despues):
            respuesta = self.client.post("/api/auth/recuperacion/confirmar/", datos)
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.json()["codes"]["non_field_errors"], ["enlace_invalido"])


class SuspensionAccesoTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user("suspendida@example.com", CLAVE)

    def test_ADMIN_3_c1_cuenta_suspendida_no_inicia_sesion(self):
        self.usuario.is_active = False
        self.usuario.save()
        respuesta = self.client.post("/api/auth/token/", {"email": "suspendida@example.com", "password": CLAVE})
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(respuesta.json()["code"], "cuenta_suspendida")

    def test_ADMIN_3_c1_suspension_invalida_tokens_ya_emitidos(self):
        tokens = self.client.post("/api/auth/token/", {"email": "suspendida@example.com", "password": CLAVE}).data
        self.usuario.is_active = False
        self.usuario.save()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        respuesta = self.client.get("/api/auth/yo/")
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(respuesta.json(), {"detail": "La cuenta está suspendida.", "code": "user_inactive"})
        self.client.credentials()
        refresco = self.client.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]})
        self.assertEqual(refresco.status_code, 401)

    def test_ADMIN_3_c1_suspendida_con_contrasena_erronea_no_revela_suspension(self):
        self.usuario.is_active = False
        self.usuario.save()
        respuesta = self.client.post("/api/auth/token/", {"email": "suspendida@example.com", "password": "mala-clave-000"})
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(respuesta.json()["code"], "no_active_account")


class CasosLimiteAccesoTests(APITestCase):
    """ACCESS-1 · criterio 3 y ADMIN-4 · criterio 2: casos que no cubrían las demás pruebas."""

    def test_ACCESS_1_c3_enlace_con_usuario_invalido_o_inexistente(self):
        for uid in ["no-es-base64", "OTk5OTk"]:  # "OTk5OTk" = "99999", un id que no existe
            respuesta = self.client.post(
                "/api/auth/recuperacion/confirmar/", {"uid": uid, "token": "x", "password": "nueva-clave-456"}
            )
            self.assertEqual(respuesta.status_code, 400, uid)
            self.assertEqual(respuesta.json()["codes"]["non_field_errors"], ["enlace_invalido"])

    def test_ADMIN_4_c2_no_se_asigna_un_rol_que_ya_se_tiene(self):
        admin = Usuario.objects.create_user("admin@example.com", CLAVE, nombre="Admin", es_administrador=True)
        otro_admin = Usuario.objects.create_user("otro@example.com", CLAVE, nombre="Otro", es_administrador=True)
        normal = Usuario.objects.create_user("normal@example.com", CLAVE, nombre="Normal")
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post(f"/api/admin/usuarios/{otro_admin.pk}/asignar-admin/").status_code, 409)
        self.assertEqual(self.client.post(f"/api/admin/usuarios/{normal.pk}/revocar-admin/").status_code, 409)
