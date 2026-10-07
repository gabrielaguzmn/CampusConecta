from django.test import TestCase

from cuentas.models import Usuario


class UsuarioTests(TestCase):
    def test_ACCESS_1_contrasena_guardada_con_hash(self):
        usuario = Usuario.objects.create_user("persona@cualquier-dominio.org", "clave-segura-123")
        self.assertNotEqual(usuario.password, "clave-segura-123")
        self.assertTrue(usuario.check_password("clave-segura-123"))

    def test_ACCESS_1_nueva_cuenta_activa_y_sin_rol_administrador(self):
        usuario = Usuario.objects.create_user("persona@example.com", "clave-segura-123")
        self.assertTrue(usuario.is_active)
        self.assertFalse(usuario.es_administrador)
