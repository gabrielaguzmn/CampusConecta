from rest_framework import serializers

from .semantic.engine import INTENTS


class SemanticMatchSerializer(serializers.Serializer):
    text = serializers.CharField(trim_whitespace=True, min_length=1, max_length=200)
    page = serializers.ChoiceField(choices=("MAP", "FEED", "MY_EVENTS", "CREATE_EVENT"))
    candidate_intents = serializers.ListField(child=serializers.ChoiceField(choices=INTENTS), required=False, allow_empty=False)

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("El cuerpo debe ser un objeto JSON.")
        for field in ("text", "page"):
            if field in data and not isinstance(data[field], str):
                raise serializers.ValidationError({field: "Debe ser texto."})
        if "candidate_intents" in data and (not isinstance(data["candidate_intents"], list) or not all(isinstance(v, str) for v in data["candidate_intents"])):
            raise serializers.ValidationError({"candidate_intents": "Debe ser una lista de textos."})
        return super().to_internal_value(data)

    def validate(self, attrs):
        text = attrs["text"]
        if not isinstance(text, str):
            raise serializers.ValidationError({"text": "Debe ser texto."})
        return attrs
