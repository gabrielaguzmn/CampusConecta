import json
import urllib.error
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from cuentas.models import Usuario
from eventos.models import Evento, Fecha

URL = "/api/auth/voz/token/"
CLAVE_PRUEBA = "clave-ficticia-deepgram-para-pruebas"
PASSWORD = "clave-segura-123"


class TokenDeepgramTests(APITestCase):
    """VOICE-1: emisión autenticada y efímera del token de voz."""

    def setUp(self):
        self.usuario = Usuario.objects.create_user("voz@example.test", PASSWORD, nombre="Persona de prueba")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.usuario)}")

    @staticmethod
    def respuesta_deepgram(datos):
        respuesta = MagicMock()
        respuesta.__enter__.return_value = respuesta
        respuesta.read.return_value = json.dumps(datos).encode()
        return respuesta

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_solicita_token_temporal_con_ttl_y_autorizacion(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({"access_token": "token-temporal", "expires_in": 30})
        respuesta = self.client.post(URL)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), {"access_token": "token-temporal", "expires_in": 30})
        peticion = urlopen.call_args.args[0]
        self.assertEqual(peticion.full_url, "https://api.deepgram.com/v1/auth/grant")
        self.assertEqual(json.loads(peticion.data), {"ttl_seconds": 30})
        self.assertEqual(peticion.get_header("Authorization"), f"Token {CLAVE_PRUEBA}")
        self.assertEqual(urlopen.call_args.kwargs, {"timeout": 5})

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_respeta_expires_in_del_proveedor(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({"access_token": "temporal", "expires_in": 30})
        self.assertEqual(self.client.post(URL).json()["expires_in"], 30)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_expires_in_ausente_no_supera_30_segundos(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({"access_token": "temporal"})
        respuesta = self.client.post(URL)
        self.assertLessEqual(respuesta.json()["expires_in"], 30)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_rechaza_tiempo_de_vida_mayor_a_30_segundos(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({"access_token": "temporal", "expires_in": 60})
        respuesta = self.client.post(URL)
        self.assertLessEqual(respuesta.json()["expires_in"], 30)

    def test_VOICE_1_c1_sin_clave_responde_503(self):
        with override_settings(DEEPGRAM_API_KEY=""):
            respuesta = self.client.post(URL)
        self.assertEqual(respuesta.status_code, 503)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_http_error_responde_503(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(URL, 401, "no autorizado", {}, None)
        self.assertEqual(self.client.post(URL).status_code, 503)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_error_de_red_responde_503(self, urlopen):
        urlopen.side_effect = urllib.error.URLError("sin conexión")
        self.assertEqual(self.client.post(URL).status_code, 503)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_timeout_responde_503(self, urlopen):
        urlopen.side_effect = TimeoutError("tiempo agotado")
        self.assertEqual(self.client.post(URL).status_code, 503)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_json_invalido_responde_503(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({})
        urlopen.return_value.read.return_value = b"{"
        self.assertEqual(self.client.post(URL).status_code, 503)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_VOICE_1_c1_respuesta_sin_access_token_responde_503(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({"expires_in": 30})
        self.assertEqual(self.client.post(URL).status_code, 503)

    def test_VOICE_1_c1_token_requiere_sesion(self):
        self.client.credentials()
        self.assertEqual(self.client.post(URL).status_code, 401)

    def test_VOICE_1_c1_rechaza_jwt_vencido(self):
        token = AccessToken.for_user(self.usuario)
        token.set_exp(from_time=timezone.now() - timedelta(minutes=5), lifetime=timedelta(seconds=1))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.post(URL).status_code, 401)

    def test_VOICE_1_c1_rechaza_jwt_alterado(self):
        token = str(AccessToken.for_user(self.usuario))
        token_alterado = token[:-1] + ("a" if token[-1] != "a" else "b")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_alterado}")
        self.assertEqual(self.client.post(URL).status_code, 401)

    def test_VOICE_1_DoD_solo_acepta_post(self):
        token = AccessToken.for_user(self.usuario)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        for metodo in (self.client.get, self.client.put, self.client.delete):
            self.assertEqual(metodo(URL).status_code, 405)

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_RNF011_clave_no_se_filtra_en_respuesta_detail_ni_registros(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(URL, 401, "fallo", {}, None)
        with self.assertLogs("cuentas.voz", level="WARNING") as registros:
            respuesta = self.client.post(URL)
        self.assertNotIn(CLAVE_PRUEBA, respuesta.content.decode())
        self.assertNotIn(CLAVE_PRUEBA, respuesta.json()["detail"])
        self.assertNotIn(CLAVE_PRUEBA, "\n".join(registros.output))

    @override_settings(DEEPGRAM_API_KEY=CLAVE_PRUEBA)
    @patch("cuentas.voz.urllib.request.urlopen")
    def test_RNF008_emision_no_crea_ni_modifica_registros(self, urlopen):
        urlopen.return_value = self.respuesta_deepgram({"access_token": "temporal", "expires_in": 30})
        antes = (Usuario.objects.count(), Evento.objects.count(), Fecha.objects.count())
        self.client.post(URL)
        despues = (Usuario.objects.count(), Evento.objects.count(), Fecha.objects.count())
        self.assertEqual(despues, antes)
