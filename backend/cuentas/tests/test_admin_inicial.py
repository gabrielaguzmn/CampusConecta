from io import StringIO
from unittest import mock

from django.core.management import CommandError, call_command
from django.test import TestCase

from cuentas.models import Usuario

ENTORNO = {"ADMIN_INICIAL_NOMBRE": "Responsable de la plataforma", "ADMIN_INICIAL_EMAIL": "admin@example.com", "ADMIN_INICIAL_PASSWORD": "clave-admin-segura-1"}


class AdminInicialTests(TestCase):
    def ejecutar(self, entorno):
        with mock.patch.dict("os.environ", entorno, clear=False):
            call_command("crear_admin_inicial", stdout=StringIO())

    def test_ADMIN_4_c1_crea_cuenta_administradora_desde_el_entorno(self):
        self.ejecutar(ENTORNO)
        admin = Usuario.objects.get(email="admin@example.com")
        self.assertTrue(admin.es_administrador)
        self.assertTrue(admin.check_password("clave-admin-segura-1"))
        self.assertEqual(admin.nombre, "Responsable de la plataforma")

    def test_ADMIN_4_c1_no_modifica_una_cuenta_existente(self):
        Usuario.objects.create_user("admin@example.com", "otra-clave-segura-2")
        self.ejecutar(ENTORNO)
        self.assertTrue(Usuario.objects.get(email="admin@example.com").check_password("otra-clave-segura-2"))

    def test_ADMIN_4_c1_falla_sin_variables_de_entorno(self):
        with self.assertRaises(CommandError):
            self.ejecutar({"ADMIN_INICIAL_NOMBRE": "", "ADMIN_INICIAL_EMAIL": "", "ADMIN_INICIAL_PASSWORD": ""})
        self.assertFalse(Usuario.objects.exists())

    def test_ADMIN_4_c1_rechaza_contrasena_debil(self):
        with self.assertRaises(CommandError):
            self.ejecutar({**ENTORNO, "ADMIN_INICIAL_PASSWORD": "123"})
        self.assertFalse(Usuario.objects.exists())
