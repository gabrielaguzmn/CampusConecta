from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cuentas", "0001_initial")]

    operations = [
        # G-08: nombre obligatorio. Las cuentas existentes quedan con nombre vacío.
        migrations.AddField(
            model_name="usuario",
            name="nombre",
            field=models.TextField(default=""),
            preserve_default=False,
        ),
    ]
