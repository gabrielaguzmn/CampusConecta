from django.db import models


class Norma(models.IntegerChoices):
    """Normas de uso de la plataforma (definicion_mvp.md · "Normas de uso"): base de la moderación y de las causas de
    reporte. G-20 y G-21 (decisión 2026-10-07): la causa y el motivo se eligen de esta lista."""

    AMBITO = 1, "Ámbito de los eventos"
    INFORMACION_VERAZ = 2, "Información veraz y completa"
    RESPETO = 3, "Respeto y convivencia"
    LICITAS = 4, "Actividades y ventas lícitas"
    SIN_SPAM = 5, "Sin spam, duplicados ni publicidad ajena"
    PRIVACIDAD = 6, "Privacidad"
    PROPIEDAD_INTELECTUAL = 7, "Propiedad intelectual"
    ESPACIOS = 8, "Uso de los espacios del campus"
    RESPONSABILIDAD = 9, "Responsabilidad sobre el evento"
    CUENTA_PERSONAL = 10, "Cuenta personal y reportes de buena fe"
