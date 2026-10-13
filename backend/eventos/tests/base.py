from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from cuentas.models import Usuario
from eventos.models import Categoria, Evento, Fecha, Ubicacion

CLAVE = "clave-segura-123"


def en(horas):
    """Momento relativo a ahora, en horas (negativo = pasado)."""
    return timezone.now() + timedelta(hours=horas)


class BaseEventosTest(APITestCase):
    def setUp(self):
        self.creador = Usuario.objects.create_user("creador@example.com", CLAVE)
        self.otro = Usuario.objects.create_user("otro@example.com", CLAVE)
        self.admin = Usuario.objects.create_user("admin@example.com", CLAVE, es_administrador=True)
        self.categoria = Categoria.objects.get(nombre="Talleres")
        self.ubicacion = Ubicacion.objects.create(nombre="Edificio de prueba")
        self.client.force_authenticate(self.creador)

    def crear_evento(self, *horarios, creador=None, **campos):
        """Crea un evento directamente en la base de datos; `horarios` son pares (inicio, fin) en horas desde ahora."""
        evento = Evento.objects.create(
            creador=creador or self.creador,
            nombre="Taller de cerámica",
            categoria=self.categoria,
            descripcion="Descripción",
            responsable="Club de cerámica",
            ubicacion=self.ubicacion,
            **campos,
        )
        for inicio, fin in horarios or [(24, 26)]:
            Fecha.objects.create(evento=evento, inicio=en(inicio), fin=en(fin))
        return evento

    def datos_evento(self, **cambios):
        datos = {
            "nombre": "Taller de cerámica",
            "categoria": self.categoria.pk,
            "descripcion": "Explora el barro.",
            "responsable": "Club de cerámica",
            "ubicacion": self.ubicacion.pk,
            "fechas": [{"inicio": en(24).isoformat(), "fin": en(26).isoformat()}],
        }
        datos.update(cambios)
        return datos

    def como(self, usuario):
        self.client.force_authenticate(usuario)
