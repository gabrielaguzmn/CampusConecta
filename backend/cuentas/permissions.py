from rest_framework.permissions import BasePermission


class EsAdministrador(BasePermission):
    """RF-024: el módulo de administración es exclusivo del rol administrador."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.es_administrador)
