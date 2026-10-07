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
        self.assertIn("email", respuesta.data)

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
        self.assertEqual(respuesta.data["detail"].code, "no_active_account")

    def test_ACCESS_1_DoD_sin_sesion_no_hay_acceso(self):
        self.assertEqual(self.client.get("/api/auth/yo/").status_code, 401)

    # --- Criterio 3: recuperación por correo (G-17) ---

    def enlace_del_correo(self):
        return dict(re.findall(r"[?&](uid|token)=([^&\s]+)", mail.outbox[-1].body))

    def test_ACCESS_1_c3_solicitud_envia_enlace_por_correo(self):
        Usuario.objects.create_user("olvido@example.com", CLAVE)
        respuesta = self.client.post("/api/auth/recuperacion/", {"email": "olvido@example.com"})
        self.assertEqual(respuesta.status_code, 204)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["olvido@example.com"])
        self.assertIn("https://frontend.test/recuperar?uid=", mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].subject, "Recupera tu contraseña de CampusConecta")

    def test_ACCESS_1_c3_correo_inexistente_responde_igual_sin_enviar(self):
        respuesta = self.client.post("/api/auth/recuperacion/", {"email": "nadie@example.com"})
        self.assertEqual(respuesta.status_code, 204)
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
        self.assertEqual(respuesta.data["non_field_errors"][0].code, "enlace_invalido")


class SuspensionAccesoTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user("suspendida@example.com", CLAVE)

    def test_ADMIN_3_c1_cuenta_suspendida_no_inicia_sesion(self):
        self.usuario.is_active = False
        self.usuario.save()
        respuesta = self.client.post("/api/auth/token/", {"email": "suspendida@example.com", "password": CLAVE})
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(respuesta.data["detail"].code, "cuenta_suspendida")

    def test_ADMIN_3_c1_suspension_invalida_tokens_ya_emitidos(self):
        tokens = self.client.post("/api/auth/token/", {"email": "suspendida@example.com", "password": CLAVE}).data
        self.usuario.is_active = False
        self.usuario.save()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.assertEqual(self.client.get("/api/auth/yo/").status_code, 401)
        self.client.credentials()
        refresco = self.client.post("/api/auth/token/refresh/", {"refresh": tokens["refresh"]})
        self.assertEqual(refresco.status_code, 401)

    def test_ADMIN_3_c1_suspendida_con_contrasena_erronea_no_revela_suspension(self):
        self.usuario.is_active = False
        self.usuario.save()
        respuesta = self.client.post("/api/auth/token/", {"email": "suspendida@example.com", "password": "mala-clave-000"})
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(respuesta.data["detail"].code, "no_active_account")
