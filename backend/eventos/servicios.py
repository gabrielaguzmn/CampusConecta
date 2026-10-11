"""Eliminación de eventos y fechas (RF-017, G-24). Es un borrado lógico: el contenido deja de estar disponible en toda
la plataforma, pero la fila se conserva para que el registro de moderación (RF-034) siga apuntando a ella."""

from eventos.models import PROXIMA


def eliminar_fecha(fecha):
    fecha.eliminado = True
    fecha.save(update_fields=["eliminado"])


def eliminar_evento(evento):
    """Retira el evento y todas sus fechas."""
    evento.fechas.update(eliminado=True)
    if evento.imagen:
        evento.imagen.delete(save=False)
        evento.imagen = None
    evento.eliminado = True
    evento.save(update_fields=["eliminado", "imagen"])


def eliminar_fechas_proximas(evento):
    """PUBLICATION-8 · criterio 2: elimina el evento completo si todas sus fechas son próximas; si además tiene fechas
    en vivo, finalizadas o canceladas, solo retira las próximas y el evento sigue (con ellas) en la plataforma.
    Devuelve True si el evento completo fue eliminado."""
    fechas = list(evento.fechas.all())
    proximas = [f for f in fechas if f.estado() == PROXIMA]
    if len(proximas) == len(fechas):
        eliminar_evento(evento)
        return True
    for fecha in proximas:
        eliminar_fecha(fecha)
    return False
