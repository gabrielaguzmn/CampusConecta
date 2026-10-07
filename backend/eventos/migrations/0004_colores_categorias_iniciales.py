from django.db import migrations

# G-02 / G-54 (decisión 2026-10-07): colores de las seis categorías iniciales.
COLORES = {
    "Ventas": "#E0E800",
    "Talleres": "#1FE425",
    "Entretenimiento": "#0DC8CE",
    "Integración": "#E07223",
    "Deportes y recreación": "#E20000",
    "Cultura y arte": "#A81DDF",
}


def asignar(apps, schema_editor):
    Categoria = apps.get_model("eventos", "Categoria")
    for nombre, color in COLORES.items():
        # Solo si aún no tiene color, para no pisar lo que haya editado un administrador.
        Categoria.objects.filter(nombre=nombre, color__isnull=True).update(color=color)


def quitar(apps, schema_editor):
    apps.get_model("eventos", "Categoria").objects.filter(nombre__in=COLORES).update(color=None)


class Migration(migrations.Migration):
    dependencies = [("eventos", "0003_categoria_color")]

    operations = [migrations.RunPython(asignar, quitar)]
