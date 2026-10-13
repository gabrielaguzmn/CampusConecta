from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import IntegrityError
from django.test import TestCase

from cuentas.models import Usuario
from eventos.models import CANCELADA, EN_VIVO, FINALIZADA, PROXIMA, Categoria, Evento, Fecha, Ubicacion

BOGOTA = ZoneInfo("America/Bogota")
INICIO = datetime(2026, 10, 20, 10, 0, tzinfo=BOGOTA)
FIN = datetime(2026, 10, 20, 13, 0, tzinfo=BOGOTA)


def crear_evento():
    creador = Usuario.objects.create_user("creador@example.com", "clave-segura-123")
    return Evento.objects.create(
        creador=creador,
        nombre="Taller",
        categoria=Categoria.objects.get(nombre="Talleres"),
        descripcion="Descripción",
        responsable="Responsable",
        ubicacion=Ubicacion.objects.create(nombre="Ubicación de prueba"),
    )


class CatalogoInicialTests(TestCase):
    def test_CATEGORY_1_c1_catalogo_inicial_disponible(self):
        nombres = list(Categoria.objects.filter(activa=True).values_list("nombre", flat=True))
        self.assertEqual(
            nombres,
            ["Ventas", "Talleres", "Entretenimiento", "Integración", "Deportes y recreación", "Cultura y arte"],
        )


class EstadoFechaTests(TestCase):
    def setUp(self):
        self.fecha = Fecha.objects.create(evento=crear_evento(), inicio=INICIO, fin=FIN)

    def assertEstado(self, ahora, esperado):
        self.assertEqual(self.fecha.estado(ahora), esperado)
        anotado = Fecha.objects.con_estado(ahora).get(pk=self.fecha.pk).estado_calculado
        self.assertEqual(anotado, esperado)

    def test_PUBLICATION_2_c2_proxima_antes_del_inicio(self):
        self.assertEstado(INICIO - timedelta(seconds=1), PROXIMA)

    def test_PUBLICATION_2_c2_en_vivo_desde_el_inicio(self):
        self.assertEstado(INICIO, EN_VIVO)
        self.assertEstado(FIN - timedelta(seconds=1), EN_VIVO)

    def test_PUBLICATION_2_c2_finalizada_desde_el_fin(self):
        self.assertEstado(FIN, FINALIZADA)

    def test_PUBLICATION_2_c1_cancelada_es_permanente(self):
        # G-32: una fecha cancelada nunca pasa a finalizada.
        self.fecha.cancelada = True
        self.fecha.save()
        self.assertEstado(INICIO - timedelta(hours=1), CANCELADA)
        self.assertEstado(FIN + timedelta(days=1), CANCELADA)

    def test_PUBLICATION_6_c3_finalizada_anticipadamente_deja_de_estar_en_vivo(self):
        self.fecha.finalizada_en = INICIO + timedelta(hours=1)
        self.fecha.save()
        self.assertEstado(INICIO + timedelta(hours=2), FINALIZADA)

    def test_PUBLICATION_7_c3_extendida_sigue_en_vivo_hasta_el_nuevo_fin(self):
        self.fecha.fin = FIN + timedelta(hours=2)
        self.fecha.save()
        self.assertEstado(FIN + timedelta(hours=1), EN_VIVO)
        self.assertEstado(FIN + timedelta(hours=2), FINALIZADA)

    def test_PUBLICATION_1_fin_debe_ser_posterior_al_inicio(self):
        # G-31: restricción en la base de datos.
        with self.assertRaises(IntegrityError):
            Fecha.objects.create(evento=self.fecha.evento, inicio=FIN, fin=INICIO)
