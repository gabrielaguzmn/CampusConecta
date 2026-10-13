import re
import unittest
from io import StringIO
from pathlib import Path

from django.core.management import call_command

from eventos.management.commands.seed_ubicaciones import filas
from eventos.models import Ubicacion
from eventos.tests.base import BaseEventosTest

CAMPUS_DATA = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "Campusdata.ts"


def lugares_del_plano():
    """Ids de lugares que arma frontend/src/lib/Campusdata.ts (mismo cálculo que `lugares` allí)."""
    texto = CAMPUS_DATA.read_text()
    bloque = texto.split("const edificios")[1].split("const carpeta")[0]
    ids = set()
    for zona, lista in re.findall(r"([A-E]): \[([^\]]*)\]", bloque):
        for archivo in re.findall(r"'([^']+)'", lista):
            ids.add(f"{zona}:" + re.sub(r"\.svg$", "", re.sub(r"-interactive(?=\.svg$)", "", archivo)))
    return ids | set(re.findall(r"codigo: '([^']+)'", texto))


class CatalogoUbicacionesTests(BaseEventosTest):
    """RF-009, G-01: catálogo fijo de ubicaciones (comando seed_ubicaciones) y su consulta."""

    def cargar(self):
        call_command("seed_ubicaciones", stdout=StringIO())

    def test_RF009_el_comando_carga_el_catalogo_completo(self):
        self.cargar()
        codigos = set(Ubicacion.objects.exclude(codigo=None).values_list("codigo", flat=True))
        self.assertEqual(codigos, {f[0] for f in filas()})
        plazoleta = Ubicacion.objects.get(codigo="E:PlazoletaCentral")
        self.assertEqual((plazoleta.nombre, plazoleta.tipo, plazoleta.zona), ("Plazoleta Central", "plazoleta", "E"))
        self.assertEqual(Ubicacion.objects.get(codigo="E:E6-E12").nombre, "Edificios E6 y E12")

    def test_RF009_ejecutarlo_dos_veces_no_duplica(self):
        self.cargar()
        total = Ubicacion.objects.count()
        self.cargar()
        self.assertEqual(Ubicacion.objects.count(), total)

    def test_RF009_reutiliza_una_ubicacion_existente_con_el_mismo_nombre(self):
        # Los eventos que ya apuntaban a esa ubicación no se rompen.
        anterior = Ubicacion.objects.create(nombre="Plazoleta Central")
        evento = self.crear_evento()
        evento.ubicacion = anterior
        evento.save()
        self.cargar()
        anterior.refresh_from_db()
        self.assertEqual((anterior.codigo, anterior.zona), ("E:PlazoletaCentral", "E"))
        self.assertEqual(Ubicacion.objects.filter(nombre="Plazoleta Central").count(), 1)
        evento.refresh_from_db()
        self.assertEqual(evento.ubicacion_id, anterior.pk)

    def test_PUBLICATION_1_c3_se_consulta_el_catalogo_con_zona_tipo_y_codigo(self):
        self.cargar()
        datos = self.client.get("/api/ubicaciones/").json()
        self.assertEqual(len(datos), Ubicacion.objects.count())
        self.assertEqual(set(datos[0]), {"id", "nombre", "tipo", "zona", "codigo"})
        zonas = [u["zona"] for u in datos]
        self.assertEqual(zonas, sorted(zonas))  # ordenado por zona, como el selector del frontend

    @unittest.skipUnless(CAMPUS_DATA.exists(), "el frontend no está en este checkout")
    def test_G01_codigos_del_catalogo_coinciden_con_el_plano_del_frontend(self):
        # Si un código no coincide, la ubicación no tiene pin en el mapa (y viceversa).
        self.assertEqual({f[0] for f in filas()}, lugares_del_plano())
