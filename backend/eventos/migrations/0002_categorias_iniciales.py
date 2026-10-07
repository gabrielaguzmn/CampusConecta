from django.db import migrations

# CATEGORY-1 · criterio 1, RF-022: catálogo inicial.
CATEGORIAS_INICIALES = ["Ventas", "Talleres", "Entretenimiento", "Integración", "Deportes y recreación", "Cultura y arte"]


def crear(apps, schema_editor):
    Categoria = apps.get_model("eventos", "Categoria")
    for nombre in CATEGORIAS_INICIALES:
        Categoria.objects.get_or_create(nombre=nombre)


def borrar(apps, schema_editor):
    apps.get_model("eventos", "Categoria").objects.filter(nombre__in=CATEGORIAS_INICIALES).delete()


class Migration(migrations.Migration):
    dependencies = [("eventos", "0001_initial")]

    operations = [migrations.RunPython(crear, borrar)]
