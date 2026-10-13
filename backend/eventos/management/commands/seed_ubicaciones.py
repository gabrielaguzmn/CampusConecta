from django.core.management.base import BaseCommand

from eventos.models import Ubicacion

# Mismos códigos que usa el front (campusData.ts): "<zona>:<archivo del plano sin -interactive ni .svg>"
EDIFICIOS = {
    "A": ["A1", "A2", "A7"],
    "B": ["B1", "B2", "B4", "B13", "B14", "B15", "B16", "B17", "B18", "B19", "B20", "B21", "B22", "B24", "LagoExperimental"],
    "C": [f"C{n}" for n in (5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23)],
    "D": ["D1", "D2", "D4", "D5", "D6", "D7", "D9", "D10", "D12", "D13", "D14", "D16", "D17", "LagoCentral"],
    "E": ["E1", "E6-E12", "E15", "E17", "E18", "E19", "E20", "E22", "E23", "E24", "E26", "E27-E28", "E29-E30",
          "E32", "E33", "E37", "E38-E39", "E42", "E43", "E44", "E46-E47", "E48", "E50", "E52-E53", "E55", "E56-E49"],
}
PLAZOLETAS = {
    "E:PlazoletaCentral": "Plazoleta Central",
    "E:HallDeLosPasosPerdidos": "Hall de los Pasos Perdidos",
    "E:PlazoletaDeLasPalmeras": "Plazoleta de las Palmeras",
    "E:PlazoletaIngenierias": "Plazoleta Ingenierías",
}
LAGOS = {"LagoExperimental": "Lago Experimental", "LagoCentral": "Lago Central"}


def nombre_edificio(codigo):
    if codigo in LAGOS:
        return LAGOS[codigo]
    partes = codigo.split("-")
    return ("Edificios " + " y ".join(partes)) if len(partes) > 1 else f"Edificio {codigo}"


def filas():
    for zona, codigos in EDIFICIOS.items():
        for c in codigos:
            tipo = Ubicacion.OTRO if c in LAGOS else Ubicacion.EDIFICIO
            yield f"{zona}:{c}", nombre_edificio(c), tipo, zona
    for codigo, nombre in PLAZOLETAS.items():
        yield codigo, nombre, Ubicacion.PLAZOLETA, "E"
    # Canchas: agregar aquí cuando existan sus planos, p. ej. ("B:CanchaFutbol", "Cancha de fútbol", Ubicacion.CANCHA, "B")


class Command(BaseCommand):
    help = "Carga el catálogo de ubicaciones del campus (zona, tipo y código del plano)."

    def handle(self, *args, **opciones):
        creadas = actualizadas = 0
        for codigo, nombre, tipo, zona in filas():
            # Si ya existía una ubicación con ese nombre (catálogo anterior), se reutiliza para no romper eventos.
            obj = Ubicacion.objects.filter(codigo=codigo).first() or Ubicacion.objects.filter(nombre=nombre).first()
            if obj is None:
                Ubicacion.objects.create(codigo=codigo, nombre=nombre, tipo=tipo, zona=zona)
                creadas += 1
            else:
                obj.codigo, obj.tipo, obj.zona = codigo, tipo, zona
                obj.save(update_fields=["codigo", "tipo", "zona"])
                actualizadas += 1
        self.stdout.write(self.style.SUCCESS(f"Ubicaciones: {creadas} creadas, {actualizadas} actualizadas."))