from rest_framework import serializers

from cuentas.models import Usuario
from moderacion.models import CasoReporte, RegistroModeracion, Reporte
from moderacion.normas import Norma


class NormaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()


class UsuarioBreveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ["id", "nombre", "email"]


class ReporteEntradaSerializer(serializers.ModelSerializer):
    """DISPLAY-3: causa obligatoria (una norma de uso, G-20) y detalles opcionales."""

    class Meta:
        model = Reporte
        fields = ["causa", "detalles"]


class ReporteSerializer(serializers.ModelSerializer):
    usuario = UsuarioBreveSerializer()

    class Meta:
        model = Reporte
        fields = ["id", "usuario", "causa", "detalles"]


class EventoBreveSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    oculto = serializers.BooleanField()
    creador = UsuarioBreveSerializer()


class CasoSerializer(serializers.ModelSerializer):
    """ADMIN-2 · criterio 1: un caso por evento con todos sus reportes."""

    evento = EventoBreveSerializer()
    reportes = ReporteSerializer(many=True)

    class Meta:
        model = CasoReporte
        fields = ["id", "evento", "estado", "decision_ocultar", "reportes"]


class MotivoSerializer(serializers.Serializer):
    """RF-034, G-21: norma incumplida y explicación opcional."""

    norma = serializers.ChoiceField(choices=Norma.choices)
    explicacion = serializers.CharField(required=False, allow_blank=True, default="")


class CasoActualizacionSerializer(serializers.Serializer):
    """ADMIN-2 · criterios 2 y 3. Al pasar a "revisado" se decide si el evento se oculta; si se oculta, con su motivo."""

    # TODO(PENDIENTE G-25: transiciones permitidas entre estados; hoy se admite cualquier cambio)
    estado = serializers.ChoiceField(choices=CasoReporte.ESTADOS)
    decision_ocultar = serializers.BooleanField(required=False, allow_null=True, default=None)
    norma = serializers.ChoiceField(choices=Norma.choices, required=False)
    explicacion = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, datos):
        revisado = datos["estado"] == CasoReporte.REVISADO
        if revisado and datos["decision_ocultar"] is None:
            raise serializers.ValidationError({"decision_ocultar": "Al pasar a revisado hay que decidir si se oculta."})
        if not revisado and datos["decision_ocultar"] is not None:
            raise serializers.ValidationError({"decision_ocultar": "La decisión solo se toma al pasar a revisado."})
        if datos["decision_ocultar"] and "norma" not in datos:
            raise serializers.ValidationError({"norma": "Para ocultar hay que indicar la norma incumplida."})
        return datos


class RegistroModeracionSerializer(serializers.ModelSerializer):
    """ADMIN-4 · criterio 3: datos completos de cada acción."""

    administrador = UsuarioBreveSerializer()
    cuenta_afectada = UsuarioBreveSerializer()

    class Meta:
        model = RegistroModeracion
        fields = [
            "id", "fecha_hora", "administrador", "tipo_accion", "evento", "fecha", "cuenta_afectada",
            "norma", "explicacion", "reportes", "estado_anterior", "estado_posterior",
        ]
